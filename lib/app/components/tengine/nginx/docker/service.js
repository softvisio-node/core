import DnsWatcher from "#lib/dns/watcher";
import Ajv from "#lib/ajv";
import { readConfig } from "#lib/config";

const OPTIONS = {
    "serverNames": "nginx.http.server-names",
    "streamPorts": "nginx.stream.ports",
    "clientMaxBodySize": "nginx.http.client-max-body-size",
    "cacheEnabled": "nginx.http.cache.enabled",
    "cacheStatus": "nginx.http.cache-status",
    "cacheBypass": "nginx.http.cache.bypass",
};

const validateLabejs = new Ajv().compile( readConfig( new URL( "labels.schema.yaml", import.meta.url ) ) );

export default class DockerService {
    #nginx;
    #id;
    #hostname;
    #options = {};
    #dnsWatcher;
    #nginxServer;

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
    delete () {
        this.#dnsWatcher.stop();

        if ( this.#nginxServer ) {
            this.#nginxServer.delete();

            this.#nginxServer = null;
        }
    }

    async update ( labels ) {
        const updated = this.#updateOptions( labels );

        if ( !updated ) return;

        return this.#updateNginxServer();
    }

    // private
    #updateOptions ( labels ) {
        var serverNames;

        // prepate server names
        if ( labels["nginx.http.server-names"] ) {
            labels["nginx.http.server-names"] = labels["nginx.http.server-names"]
                .split( "," )
                .map( value => value.trim() )
                .filter( value => value )
                .sort();

            if ( labels["nginx.http.server-names"] ) {
                serverNames = [...labels["nginx.http.server-names"]];
                labels["nginx.http.server-names"] = labels["nginx.http.server-names"].map( name => name.replaceAll( "*", "text" ) );
            }
            else {
                serverNames = null;
                labels["nginx.http.server-names"] = null;
            }
        }

        // prepateee stream port
        if ( labels["nginx.stream.ports"] ) {
            labels["nginx.stream.ports"] = labels["nginx.stream.ports"]
                .split( "," )
                .map( value => value.trim() )
                .filter( value => value )
                .sort();

            labels["nginx.stream.ports"] ||= null;
        }

        var options = {};

        // labels are not valid
        if ( !validateLabejs( labels ) ) {
            console.log( `Docker service labels are not valied:\n${validateLabejs.errors}` );
        }
        else {
            labels["nginx.http.server-names"] = serverNames?.join( "," );
            labels["nginx.http.stream-ports"] = labels["nginx.http.stream-ports"]?.join( "," );

            this.#options.serverNames = this.#options.serverNames?.join( "," );
            this.#options.streamPorts = this.#options.streamPorts?.join( "," );

            var updated = false;

            for ( const [option, label] of Object.entries( OPTIONS ) ) {
                options[option] = labels[label];

                if ( options[option] !== this.#options[option] ) {
                    updated = true;
                }
            }

            options.serverNames = options.serverNames?.split( "," );
            options.streamPorts = options.streamPorts?.split( "," );
        }

        this.#options = options;

        return updated;
    }

    async #updateNginxServer () {
        if ( this.#nginxServer ) {
            this.#nginxServer.delete();
            this.#nginxServer = null;

            this.#dnsWatcher.stop();
        }

        if ( this.#options.serverNames || this.#options.streamPorts ) {
            const res = await this.#nginx.addServer( this.id, this.#options );

            if ( !res.ok ) {
                console.log( `Nginx docker service ${this.id} can't be added: ${res}` );
            }
            else {
                this.#nginxServer = res.data;

                this.#dnsWatcher.restart();
            }
        }
    }

    #onUpstreamsAdd ( addresses ) {
        this.#nginxServer?.addUpstreams( addresses );
    }

    #onUpstreamsDelete ( addresses ) {
        this.#nginxServer?.deleteUpstreams( addresses );
    }
}
