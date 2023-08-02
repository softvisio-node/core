import DnsWatcher from "#lib/dns/watcher";
import Ajv from "#lib/ajv";
import { readConfig } from "#lib/config";

const OPTIONS = {
    "serverNames": {
        "label": "nginx.http.server-name",
        "value": null,
    },
    "streamPorts": {
        "label": "nginx.stream.port",
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
        "label": "nginx.http.upstream-cache-status",
        "value": false,
    },
    "cacheBypass": {
        "label": "nginx.http.proxy-cache-bypass",
        "value": false,
    },
};

const validateOptions = new Ajv().compile( readConfig( new URL( "options.schema.yaml", import.meta.url ) ) );

export class DockerService {
    #nginx;
    #id;
    #name;
    #hostname;
    #dnsWatcher;
    #nginxServer;

    #options = {};

    // XXX
    constructor ( nginx, id, name, labels ) {
        this.#nginx = nginx;
        this.#id = id;
        this.#name = name;
        this.#hostname = "tasks." + name;

        this.#updateOptions( labels );

        if ( this.#options.serverNames || this.#options.streamPorts ) {
            const res = this.#nginx.addService( this.#name, this.#options );

            if ( !res.ok ) {
                console.log( `Unable to add nginx server`, res + "" );
            }
            else {
                this.#nginxServer = this.#nginx.getServer( this.#name );
            }

            this.#dnsWatcher = new DnsWatcher( this.#hostname, {

                // family: this.#nginx.config.listenIpFamily,
                "minInterval": 1_000,
                "maxInterval": 60_000,
                "step": 5_000,
            } )
                .on( "add", this.#onUpstreamsAdd.bind( this ) )
                .on( "delete", this.#onUpstreamsDelete.bind( this ) );
        }
    }

    // properties
    get id () {
        return this.#id;
    }

    // public
    start () {}

    stop () {
        this.#dnsWatcher?.stop();
    }

    // XXX
    async update ( labels ) {
        const updated = this.#updateOptions( labels );

        if ( !updated ) return;

        return this.#updateNginxServer();
    }

    restort () {
        this.#dnsWatcher?.restart();
    }

    // update () {
    //     this.#dnsWatcher?.lookup( { "force": true } );
    // }

    reset () {
        this.#dnsWatcher.reset();
    }

    // private
    // XXX validate
    #updateOptions ( labels ) {
        const options = {};

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
        if ( !validateOptions( options ) ) {
            console.log( `Docker service options are not valied:\n${validateOptions.errors}` );

            this.#options = {};

            return;
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

    // XXX dns watcher
    async #updateNginxServer () {
        if ( this.#nginxServer ) {
            await this.#nginxServer.delete();

            this.#nginxServer = null;
        }

        if ( this.#options.serverNames || this.#options.streamPorts ) {
            const res = this.#nginx.addServer( this.#name, this.#options );

            if ( !res.ok ) return;

            this.#nginxServer = this.#nginx.getServer( this.#name );
        }
    }

    #onUpstreamsAdd ( addresses ) {
        this.emit( "upstreamAdd", addresses );
    }

    #onUpstreamsDelete ( addresses ) {
        this.emit( "upstreamDelete", addresses );
    }
}
