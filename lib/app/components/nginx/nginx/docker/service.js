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
    // XXX
    async #update ( labels ) {
        this.delete();

        if ( !labels.nginx ) return;

        const proxies = {};

        for ( let proxy of labels.nginx.split( /[,\n]/ ) ) {
            proxy = proxy.trim();

            if ( !proxy ) continue;

            // http:90?aaa=sd
            try {
                var url = new URL( "//" + proxy, "nginx://" );
            }
            catch ( e ) {
                continue;
            }

            const options = {
                "type": url.hostname,
            };

            if ( url.port ) options.port = url.port;

            for ( const [name, value] of url.searchParams.entries() ) {
                if ( value === "" ) continue;

                if ( name === "serverName" ) {
                    options.serverName ||= [];

                    options.serverName.push( value );
                }
                else {
                    options[name] = value;
                }
            }
        }

        for ( const [port, options] of Object.entries( proxies ) ) {
            if ( !validateServerOptions( options ) ) {
                console.log( `Nginx docker service: "${this.id}" config: "${port}" not valied:\n${validateServerOptions.errors}` );

                continue;
            }

            const proxy = this.#nginx.addProxy( `_docker-${this.id}`, port, options );

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
