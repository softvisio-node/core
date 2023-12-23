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
    #servers = new Map();

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
    async update ( labels ) {
        return this.#update( labels );
    }

    async delete () {
        this.#dnsWatcher.stop();

        for ( const [id, server] of this.#servers.entries() ) {
            this.#servers.delete( id );

            await server?.nginx.delete();
        }
    }

    // private
    async #update ( labels ) {
        const servers = {};

        for ( const label in labels ) {
            if ( !label.startsWith( "nginx." ) ) continue;

            // http:90?aaa=sd
            try {
                var url = new URL( "//" + labels[label], "nginx://" );
            }
            catch ( e ) {
                continue;
            }

            const options = {
                "type": url.hostname,
                "port": url.port,
                "serverName": [],
            };

            for ( const [name, value] of url.searchParams.entries() ) {
                if ( value === "" ) continue;

                if ( name === "serverName" ) {
                    options.serverName.push( value );
                }
                else {
                    options[name] = value;
                }
            }

            if ( !validateServerOptions( options ) ) {
                console.log( `Docker service nginx labels are not valied:\n${validateServerOptions.errors}` );

                continue;
            }

            const serverId = `_docker_${this.id}_${options.type}_${options.port || "default"}`;

            servers[serverId] = {
                "id": serverId,
                options,
                "optionsHash": crypto.createHash( "md5" ).update( JSON.stringify( options ) ).digest( "hex" ),
            };
        }

        let updated;

        for ( const id of this.#servers.keys() ) {

            // server removed or updated
            if ( !servers[id] || servers[id].optionsHash !== this.#servers.get( id ).optionsHash ) {
                updated = true;

                const nginxServer = this.#servers.get( id ).nginx;

                this.#servers.delete( id );

                await nginxServer?.delete();
            }
        }

        for ( const server of Object.values( servers ) ) {
            if ( this.#servers.has( server.id ) ) continue;

            updated = true;

            this.#servers.set( server.id, {
                "nginx": this.#nginx.addServer( server.id, server.options ),
                "optionsHash": server.optionsHash,
            } );
        }

        if ( updated ) {
            if ( this.#servers.size ) {
                this.#dnsWatcher.restart();
            }
            else {
                this.#dnsWatcher.stop();
            }
        }
    }

    async #onUpstreamsAdd ( addresses ) {
        for ( const server of this.#servers.values() ) {
            await server.nginx?.addUpstreams( addresses );
        }
    }

    async #onUpstreamsDelete ( addresses ) {
        for ( const server of this.#servers.values() ) {
            await server.nginx?.deleteUpstreams( addresses );
        }
    }
}
