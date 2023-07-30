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
    async _request ( method, path, { signal, params, jsonParams, body, registryAuth, registryConfig } = {} ) {
        const url = new URL( "http://local/v" + API_VERSION + "/" + path );

        if ( params ) {
            for ( const name in params ) {
                if ( params[name] === undefined ) continue;

                url.searchParams.set( name, jsonParams ? JSON.stringify( params[name] ) : params[name] );
            }
        }

        var headers = {};

        if ( registryAuth ) {
            headers["x-registry-auth"] = Buffer.from( JSON.stringify( registryAuth ) ).toString( "base64" );
        }

        if ( registryConfig ) {
            headers["x-registry-config"] = Buffer.from( JSON.stringify( registryConfig ) ).toString( "base64" );
        }

        const res = await fetch( url, {
            method,
            "agent": this.#agent,
            signal,
            headers,
            body,
        } );

        var data;

        if ( res.ok ) {

            // stream
            if ( res.headers.get( "transfer-encoding" ) === "chunked" ) {
                const jsonStream = new StreamJson();

                stream.pipeline( res.body, jsonStream, () => {} );

                return result( 200, jsonStream );
            }

            // json data
            else {
                try {
                    data = await res.json();
                }
                catch ( e ) {
                    return result.catch( e, { "silent": true, "keepError": true } );
                }

                return result( 200, data );
            }
        }

        // error
        else {
            try {
                data = await res.json();
            }
            catch ( e ) {
                return result.catch( e, { "silent": true, "keepError": true } );
            }

            return result( [res.status, data?.message || res.statusText] );
        }
    }
}
