import DnsWatcher from "#lib/dns/watcher";
import Ajv from "#lib/ajv";
import { readConfig } from "#lib/config";

const validateServerOptions = new Ajv().compile( readConfig( new URL( "server-options.schema.yaml", import.meta.url ) ) );

export default class DockerService {
    #nginx;
    #id;
    #hostname;
    #dnsWatcher;
    #nginxProxies = [];

    constructor ( nginx, id, labels ) {
        this.#nginx = nginx;
        this.#id = id;
        this.#hostname = "tasks." + id;

        this.#dnsWatcher = new DnsWatcher( this.#hostname, {

            // family: this.#nginx.config.listenIpFamily,
            "minInterval": 1_000,
            "maxInterval": 60_000,
            "step": 5_000,
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
        this.delete();

        if ( !labels.nginx ) return;

        const proxies = {};

        for ( let params of labels.nginx.split( /[\n]/ ) ) {
            params = params.trim();

            if ( !params ) continue;

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

            for ( const [name, value] of params.entries() ) {
                if ( value === "" ) continue;

                if ( name === "upstreamPort" ) {
                    upstreamPort = value;
                }
                else if ( name === "upstreamProxyProtocol" ) {
                    proxyOptions[name] = value;
                }
                else if ( name === "port" ) {
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
                    commonServerOptions[name] = value;
                }
            }

            if ( !servers?.length ) continue;

            for ( const server of servers ) {
                let tags = server.split( ":" ).map( tag => tag.trim() );

                const port = tags.shift();

                if ( !port ) continue;

                tags = new Set( tags );

                const serverOptions = { ...commonServerOptions };

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

                proxies[upstreamPort] ||= proxyOptions;
                proxies[upstreamPort].servers ||= {};
                proxies[upstreamPort].servers[port] = serverOptions;
            }
        }

        // create proxies
        for ( const [upstreamPort, options] of Object.entries( proxies ) ) {
            if ( !validateServerOptions( { upstreamPort, options } ) ) {
                console.log( `Nginx docker service: "${this.id}" config: "${upstreamPort}" not valied:\n${validateServerOptions.errors}` );

                continue;
            }

            const proxy = this.#nginx.addProxy( `_docker-${this.id}`, upstreamPort, options );

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
