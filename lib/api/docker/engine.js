import mixins from "#lib/mixins";
import fetch from "#lib/fetch";
import Agent from "#lib/http/agent";
import StreamJson from "#lib/stream/json";

import ContainersMixin from "#lib/api/docker/engine/containers";
import ImagesMixin from "#lib/api/docker/engine/images";
import ServicesMixin from "#lib/api/docker/engine/services";
import SystemMixin from "#lib/api/docker/engine/system";

// NOTE https://docs.docker.com/engine/api/latest/

const API_VERSION = "1.41";
const DEFAULT_SOCKET_PATH = "/var/run/docker.sock";

export default class DockerEngine extends mixins( ContainersMixin, ImagesMixin, ServicesMixin, SystemMixin ) {
    #_agent;

    // properties
    get #agent () {
        this.#_agent ??= new Agent( { "socketPath": DEFAULT_SOCKET_PATH } );

        return this.#_agent;
    }

    // protected
    async _request ( method, path, params ) {
        const res = await this.#request( method, path, params );

        if ( !res.ok ) return result( res );

        const data = await res.json();

        return result( 200, data );
    }

    async _stream ( path, params ) {
        const res = await this.#request( "get", path, params );

        if ( !res.ok ) throw res + "";

        const jsonStream = new StreamJson();

        jsonStream.on( "close", () => res.body.destroy() );

        res.body.pipe( jsonStream );

        return jsonStream;
    }

    // private
    async #request ( method, path, params ) {
        const url = new URL( "http://v" + API_VERSION + "/" + path );

        if ( params ) {
            for ( const name in params ) if ( params[name] !== undefined ) url.searchParams.set( name, JSON.stringify( params[name] ) );
        }

        return fetch( url, { method, "agent": this.#agent } );
    }
}
