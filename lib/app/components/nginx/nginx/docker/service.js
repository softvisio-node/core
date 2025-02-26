import crypto from "node:crypto";
import Ajv from "#lib/ajv";
import { readConfig } from "#lib/config";
import DnsWatcher from "#lib/dns/watcher";

const validateServerOptions = new Ajv().compile( await readConfig( new URL( "server-options.schema.yaml", import.meta.url ) ) );

export default class DockerService {
    #nginx;
    #id;
    #hostname;
    #dnsWatcher;
    #configHash;
    #nginxProxies = [];

    constructor ( nginx, id, labels ) {
        this.#nginx = nginx;
        this.#id = id;
        this.#hostname = "tasks." + id;

        this.#dnsWatcher = new DnsWatcher( this.#hostname, {

            // family: this.#nginx.config.listenIpFamily,
            "minInterval": 1000,
            "maxInterval": 60_000,
            "step": 5000,
        } )
            .on( "add", this.#onUpstreamsAdd.bind( this ) )
            .on( "delete", this.#onUpstreamsDelete.bind( this ) );

        this.update( labels );
    }

    // properties
    get id () {
        return this.#id;
    }

    // public
    update ( labels ) {
        const config = [];

        for ( const label of Object.keys( labels ).sort() ) {
            if ( !/^nginx(?:\.\d+)?$/.test( label ) ) continue;

            const value = labels[ label ].trim();

            if ( !value ) continue;

            config.push( value );
        }

        const configHash = crypto.createHash( "md5" ).update( JSON.stringify( config ) ).digest( "hex" );

        // config not changed
        if ( this.#configHash === configHash ) return;

        this.#configHash = configHash;

        this.delete();

        if ( !config.length ) return;

        const proxies = {};

        for ( let params of config ) {

            // upstream=80&server=443:ssl
            try {
                params = new URLSearchParams( params );
            }
            catch {
                continue;
            }

            let upstreamPort, servers;

            const proxyOptions = {},
                commonServerOptions = {};

            for ( const [ name, value ] of params.entries() ) {
                if ( value === "" ) continue;

                if ( name === "upstream" ) {
                    let tags = value.split( ":" ).map( tag => tag.trim() );

                    upstreamPort = tags.shift();

                    tags = new Set( tags );

                    if ( tags.has( "proxy-protocol" ) ) proxyOptions.upstreamProxyProtocol = true;
                }
                else if ( name === "servers" ) {
                    servers = value
                        .split( "," )
                        .map( server => server.trim() )
                        .filter( server => server );
                }
                else if ( name === "serverNames" ) {
                    proxyOptions.serverNames = value
                        .split( "," )
                        .map( serverName => serverName.trim() )
                        .filter( serverName => serverName );
                }
                else {
                    commonServerOptions[ name ] = value;
                }
            }

            if ( !servers?.length ) continue;

            for ( const server of servers ) {
                let tags = server.split( ":" ).map( tag => tag.trim() );

                const port = tags.shift();

                if ( !port ) continue;

                tags = new Set( tags );

                const serverOptions = {
                    ...commonServerOptions,
                };

                // type
                if ( tags.has( "http" ) ) {
                    serverOptions.type = "http";
                }
                else if ( tags.has( "tcp" ) ) {
                    serverOptions.type = "tcp";
                }
                else if ( tags.has( "udp" ) ) {
                    serverOptions.type = "udp";
                }

                // proxy protocol
                if ( tags.has( "proxy-protocol" ) ) {
                    serverOptions.proxyProtocol = true;
                }

                // ssl
                if ( tags.has( "ssl" ) ) {
                    serverOptions.ssl = true;
                }

                proxies[ upstreamPort ] ||= {
                    ...proxyOptions,
                    upstreamPort,
                };

                proxies[ upstreamPort ].servers ||= [];
                proxies[ upstreamPort ].servers.push( {
                    ...serverOptions,
                    port,
                } );
            }
        }

        // create proxies
        for ( const [ upstreamPort, proxyOptions ] of Object.entries( proxies ) ) {
            if ( !validateServerOptions( proxyOptions ) ) {
                console.log( `Nginx docker service: "${ this.id }" config: "${ upstreamPort }" not valid:\n${ validateServerOptions.errors }` );

                continue;
            }

            const proxyId = `docker-${ this.id }-${ upstreamPort }`;

            this.#nginx.proxies.add( proxyId, proxyOptions );

            const proxy = this.#nginx.proxies.get( proxyId );

            this.#nginxProxies.push( proxy );
        }

        // start dns watcher
        if ( this.#nginxProxies.length ) {
            this.#dnsWatcher.restart();
        }
    }

    delete () {
        this.#dnsWatcher.stop();

        for ( const proxy of this.#nginxProxies ) {
            proxy.delete();
        }

        this.#nginxProxies = [];
    }

    // private
    #onUpstreamsAdd ( addresses ) {
        for ( const proxy of this.#nginxProxies ) {
            proxy.upstreams.add( addresses );
        }
    }

    async #onUpstreamsDelete ( addresses ) {
        for ( const proxy of this.#nginxProxies ) {
            proxy.upstreams.delete( addresses );
        }
    }
}
