import DnsWatcher from "#lib/dns/watcher";
import Ajv from "#lib/ajv";
import { readConfig } from "#lib/config";

const OPTIONS = {
    "serverNames": "nginx.http.server-names",
    "streamPorts": "nginx.stream.ports",
    "maxBodySize": "nginx.http.max-body-size",
    "cacheEnabled": "nginx.http.cache.enabled",
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
    async delete () {
        this.#dnsWatcher.stop();

        if ( this.#nginxServer ) {
            await this.#nginxServer.delete();
            this.#nginxServer = null;
        }
    }

    async update ( labels ) {
        const updated = this.#updateOptions( labels );

        if ( !updated ) return;

        return this.#updateNginxServer();
    }

    // private
    // XXX
    #updateOptions ( labels ) {

        // prepate server names
        if ( labels["nginx.http.server-names"] ) {
            labels["nginx.http.server-names"] = labels["nginx.http.server-names"]
                .split( "," )
                .map( value => value.trim() )
                .filter( value => value )
                .sort();
        }
        else {
            labels["nginx.http.server-names"] = null;
        }

        // prepateee stream port
        if ( labels["nginx.stream.ports"] ) {
            labels["nginx.stream.ports"] = labels["nginx.stream.ports"]
                .split( "," )
                .map( value => value.trim() )
                .filter( value => value )
                .sort();
        }
        else {
            labels["nginx.stream.ports"] = null;
        }

        var options = {};

        // labels are not valid
        if ( !validateLabejs( labels ) ) {
            console.log( `Docker service labels are not valied:\n${validateLabejs.errors}` );
        }
        else {
            labels["nginx.http.server-names"] = labels["nginx.http.server-names"]?.join( "," );
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
        this.#dnsWatcher.stop();

        // delete nginx server
        if ( this.#nginxServer ) {
            await this.#nginxServer.delete();
            this.#nginxServer = null;
        }

        this.#nginxServer = this.#nginx.addServer( this.id, this.#options );

        this.#dnsWatcher.restart();
    }

    async #onUpstreamsAdd ( addresses ) {
        return this.#nginxServer?.addUpstreams( addresses );
    }

    async #onUpstreamsDelete ( addresses ) {
        return this.#nginxServer?.deleteUpstreams( addresses );
    }
}
