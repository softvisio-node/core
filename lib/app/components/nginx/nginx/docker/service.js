import DnsWatcher from "#lib/dns/watcher";
import Ajv from "#lib/ajv";
import { readConfig } from "#lib/config";

const OPTIONS = {
    "serverName": {
        "label": "nginx.http.server-name",
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
    "upstreamCacheStatus": {
        "label": "nginx.http.upstream-cache-status",
        "value": false,
    },
    "proxyCacheBypass": {
        "label": "nginx.http.proxy-cache-bypass",
        "value": false,
    },
    "streamPort": {
        "label": "nginx.stream.port",
        "value": null,
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

        if ( this.#options.serverName || this.#options.streamPort ) {
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

        if ( this.#nginxServer ) {
            await this.#nginxServer.delete();
        }
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
        if ( options.serverName ) {
            options.serverName = options.serverName
                .split( "," )
                .map( value => value.trim() )
                .filter( value => value )
                .sort();

            options.serverName ||= null;
        }

        // prepateee stream port
        if ( options.streamPort ) {
            options.streamPort = options.streamPort
                .split( "," )
                .map( value => value.trim() )
                .filter( value => value )
                .sort();

            options.streamPort ||= null;
        }

        // validate
        if ( !validateOptions( options ) ) {
            console.log( `Docker service options are not valied:\n${validateOptions.errors}` );

            return false;
        }

        if ( options.serverName ) options.serverName = options.serverName.join( "," );
        if ( options.streamPort ) options.streamPort = options.streamPort.join( "," );

        var updated = false;

        for ( const [option, value] of Object.entries( options ) ) {
            if ( this.#options[option] !== value ) {
                updated = true;

                this.#options[option] = value;
            }
        }

        if ( options.serverName ) options.serverName = options.serverName.split( "," );
        if ( options.streamPort ) options.streamPort = options.streamPort.split( "," );

        this.#options = options;

        return updated;
    }

    #onUpstreamsAdd ( addresses ) {
        this.emit( "upstreamAdd", addresses );
    }

    #onUpstreamsDelete ( addresses ) {
        this.emit( "upstreamDelete", addresses );
    }
}
