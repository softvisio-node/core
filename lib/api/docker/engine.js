import mixins from "#lib/mixins";
import fetch from "#lib/fetch";
import Agent from "#lib/http/agent";
import StreamJson from "#lib/stream/json";
import stream from "#lib/stream";

import ContainersMixin from "#lib/api/docker/engine/containers";
import ImagesMixin from "#lib/api/docker/engine/images";
import ServicesMixin from "#lib/api/docker/engine/services";
import SystemMixin from "#lib/api/docker/engine/system";

// NOTE https://docs.docker.com/engine/api/latest/

const API_VERSION = "1.43";
const DEFAULT_SOCKET_PATH = "/var/run/docker.sock";

export default class DockerEngine extends mixins( ContainersMixin, ImagesMixin, ServicesMixin, SystemMixin ) {
    #_agent;

    // properties
    get #agent () {
        this.#_agent ??= new Agent( { "socketPath": DEFAULT_SOCKET_PATH } );

        return this.#_agent;
    }

    // protected
    async _request ( method, path, { params, jsonParams, auth } = {} ) {
        const res = await this.#request( method, path, { params, jsonParams, auth } );

        try {
            var data = await res.json();
        }
        catch ( e ) {}

        if ( !res.ok ) return result( [res.status, data?.message || res.statusText] );

        return result( 200, data );
    }

    async _stream ( method, path, { params, jsonParams, auth } = {} ) {
        const res = await this.#request( method, path, { params, jsonParams, auth } );

        if ( !res.ok ) {
            try {
                var data = await res.json();
            }
            catch ( e ) {}

            throw result( [res.status, data?.message || res.statusText] );
        }

        const jsonStream = new StreamJson();

        stream.pipeline( res.body, jsonStream, () => {} );

        return jsonStream;
    }

    // private
    async #request ( method, path, { params, jsonParams, auth } = {} ) {
        const url = new URL( "http://local/v" + API_VERSION + "/" + path );

        if ( params ) {
            for ( const name in params ) {
                if ( params[name] === undefined ) continue;

                url.searchParams.set( name, jsonParams ? JSON.stringify( params[name] ) : params[name] );
            }
        }

        var headers;

        if ( auth ) {
            if ( typeof auth === "string" ) {
                headers = {
                    "X-Registry-Auth": auth,
                };
            }
            else {
                headers = {
                    "X-Registry-Auth": Buffer.from( JSON.stringify( auth ) ).toString( "base64" ),
                };
            }
        }

        return fetch( url, {
            method,
            "agent": this.#agent,
            headers,
        } );
    }
}
