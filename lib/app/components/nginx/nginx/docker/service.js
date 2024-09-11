import DnsWatcher from "#lib/dns/watcher";
import Ajv from "#lib/ajv";
import { readConfig } from "#lib/config";
import crypto from "node:crypto";

const validateServerOptions = new Ajv().compile( readConfig( new URL( "server-options.schema.yaml", import.meta.url ) ) );

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

            // http:90?aaa=sd
            try {
                params = new URLSearchParams( params );
            }
            catch ( e ) {
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
                else if ( name === "server" ) {
                    servers = value
                        .split( "," )
                        .map( serverName => serverName.trim() )
                        .filter( serverName => serverName );
                }
                else if ( name === "serverName" ) {
                    commonServerOptions.serverName = value
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
                    port,
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

                // ssl
                if ( tags.has( "ssl" ) ) {
                    serverOptions.sslEnabled = true;
                }

                // proxy protocol
                if ( tags.has( "proxy-protocol" ) ) {
                    serverOptions.proxyProtocol = true;
                }

                proxies[ upstreamPort ] ||= proxyOptions;
                proxies[ upstreamPort ].servers ||= [];
                proxies[ upstreamPort ].servers.push( serverOptions );
            }
        }

        // create proxies
        for ( const [ upstreamPort, options ] of Object.entries( proxies ) ) {
            if ( !validateServerOptions( { upstreamPort, options } ) ) {
                console.log( `Nginx docker service: "${ this.id }" config: "${ upstreamPort }" not valied:\n${ validateServerOptions.errors }` );

                continue;
            }

            const proxy = this.#nginx.addProxy( `docker-${ this.id }`, upstreamPort, options );

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
            proxy.addUpstreams( addresses );
        }
    }

    async #onUpstreamsDelete ( addresses ) {
        for ( const proxy of this.#nginxProxies ) {
            proxy.deleteUpstreams( addresses );
        }
    }
}
