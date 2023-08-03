import DnsWatcher from "#lib/dns/watcher";
import Ajv from "#lib/ajv";
import { readConfig } from "#lib/config";

const OPTIONS = {
    "serverNames": {
        "label": "nginx.http.server-names",
        "value": null,
    },
    "streamPorts": {
        "label": "nginx.stream.ports",
        "value": null,
    },
    "clientMaxBodySize": {
        "label": "nginx.http.client-max-body-size",
        "value": "10M",
    },
    "cacheEnabled": {
        "label": "nginx.http.cache.enabled",
        "value": true,
    },
    "cacheStatus": {
        "label": "nginx.http.cache-status",
        "value": false,
    },
    "cacheBypass": {
        "label": "nginx.http.cache.bypass",
        "value": false,
    },
};

const validateLabejs = new Ajv().compile( readConfig( new URL( "labels.schema.yaml", import.meta.url ) ) );

export default class DockerService {
    #nginx;
    #id;
    #name;
    #hostname;
    #options = {};
    #dnsWatcher;
    #nginxServer;

    constructor ( nginx, id, name, labels ) {
        this.#nginx = nginx;
        this.#id = id;
        this.#name = name;
        this.#hostname = "tasks." + name;

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
    // XXX validate labels
    // XXX validate server names - *
    #updateOptions ( labels ) {
        var options = {};

        for ( const [option, { label, value }] of Object.entries( OPTIONS ) ) {
            options[option] = labels[label] || value;
        }

        // prepate server name
        if ( options.serverNames ) {
            options.serverNames = options.serverNames
                .split( "," )
                .map( value => value.trim() )
                .filter( value => value )
                .sort();

            options.serverNames ||= null;
        }

        // prepateee stream port
        if ( options.streamPorts ) {
            options.streamPorts = options.streamPorts
                .split( "," )
                .map( value => value.trim() )
                .filter( value => value )
                .sort();

            options.streamPorts ||= null;
        }

        // options are not valid
        if ( !validateLabejs( options ) ) {
            console.log( `Docker service options are not valied:\n${validateLabejs.errors}` );

            options = {};
        }

        if ( options.serverNames ) options.serverNames = options.serverNames.join( "," );
        if ( options.streamPorts ) options.streamPorts = options.streamPorts.join( "," );

        var updated = false;

        for ( const [option, value] of Object.entries( options ) ) {
            if ( this.#options[option] !== value ) {
                updated = true;

                this.#options[option] = value;
            }
        }

        if ( options.serverNames ) options.serverNames = options.serverNames.split( "," );
        if ( options.streamPorts ) options.streamPorts = options.streamPorts.split( "," );

        this.#options = options;

        return updated;
    }

    async #updateNginxServer () {
        if ( this.#nginxServer ) {
            await this.#nginxServer.delete();

            this.#nginxServer = null;

            this.#dnsWatcher.stop();
        }

        if ( this.#options.serverNames || this.#options.streamPorts ) {
            const res = this.#nginx.addServer( this.#name, this.#options );

            if ( !res.ok ) return;

            this.#nginxServer = this.#nginx.getServer( this.#name );

            this.#dnsWatcher.restart();
        }
    }

    #onUpstreamsAdd ( addresses ) {
        this.#nginxServer?.addUpstreams( addresses );
    }

    #onUpstreamsDelete ( addresses ) {
        this.#nginxServer?.deleteUpstreams( addresses );
    }
}
