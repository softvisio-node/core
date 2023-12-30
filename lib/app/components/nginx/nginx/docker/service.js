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
        this.#update( labels );
    }

    delete () {
        this.#dnsWatcher.stop();

        for ( const proxy of this.#nginxProxies ) {
            proxy.delete();
        }

        this.#nginxProxies = [];
    }

    // private
    async #update ( labels ) {
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

            const options = {};

            for ( const [name, value] of params.entries() ) {
                if ( value === "" ) continue;

                if ( name === "upstreamPort" ) {
                    upstreamPort = value;
                }
                else if ( name === "port" ) {
                    servers = value
                        .split( "," )
                        .map( serverName => serverName.trim() )
                        .filter( serverName => serverName );
                }
                else if ( name === "serverName" ) {
                    options.serverName = value
                        .split( "," )
                        .map( serverName => serverName.trim() )
                        .filter( serverName => serverName );
                }
                else {
                    options[name] = value;
                }
            }

            if ( !servers?.length ) continue;

            for ( const server of servers ) {
                let [port, type] = server.split( ":" );

                port = port.trim();
                type = type?.trim();

                if ( !port ) continue;

                const sercerOptions = { ...options };
                if ( type ) sercerOptions.type = type;

                proxies[upstreamPort] ||= {};
                proxies[upstreamPort].servers ||= {};
                proxies[upstreamPort].servers[port] = sercerOptions;
            }
        }

        for ( const [upstreamPort, options] of Object.entries( proxies ) ) {
            if ( !validateServerOptions( { upstreamPort, options } ) ) {
                console.log( `Nginx docker service: "${this.id}" config: "${upstreamPort}" not valied:\n${validateServerOptions.errors}` );

                continue;
            }

            const proxy = this.#nginx.addProxy( `_docker-${this.id}`, upstreamPort, options );

            this.#nginxProxies.push( proxy );
        }

        if ( this.#nginxProxies.length ) {
            this.#dnsWatcher.restart();
        }
    }

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
