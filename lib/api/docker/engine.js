import mixins from "#lib/mixins";
import fetch from "#lib/fetch";
import * as jsonStream from "#lib/stream/json";
import { pipeline } from "#lib/stream";

import ContainersMixin from "#lib/api/docker/engine/containers";
import ImagesMixin from "#lib/api/docker/engine/images";
import ServicesMixin from "#lib/api/docker/engine/services";
import SystemMixin from "#lib/api/docker/engine/system";

// NOTE https://docs.docker.com/engine/api/latest/

const API_VERSION = "1.46";
const DEFAULT_SOCKET_PATH = "/var/run/docker.sock";

export default class DockerEngine extends mixins( ContainersMixin, ImagesMixin, ServicesMixin, SystemMixin ) {
    #_dispatcher;

    // protected
    async _getImageAuth ( image, credentials ) {
        if ( typeof credentials === "function" ) {
            credentials = await credentials();
        }

        const domain = image.split( "/" )[ 0 ];

        return credentials[ domain ] || credentials[ "https://index.docker.io/v1/" ];
    }

    async _request ( method, path, { stream, signal, params, body, registryAuth, registryConfig } = {} ) {
        const url = new URL( "http://local/v" + API_VERSION + "/" + path );

        if ( params ) {
            for ( const name in params ) {
                if ( params[ name ] === undefined ) continue;

                if ( typeof params[ name ] === "object" ) {
                    url.searchParams.set( name, JSON.stringify( params[ name ] ) );
                }
                else {
                    url.searchParams.set( name, params[ name ] );
                }
            }
        }

        var headers = {};

        if ( registryAuth ) {
            headers[ "x-registry-auth" ] = Buffer.from( JSON.stringify( registryAuth ) ).toString( "base64" );
        }

        if ( registryConfig ) {
            headers[ "x-registry-config" ] = Buffer.from( JSON.stringify( registryConfig ) ).toString( "base64" );
        }

        const res = await fetch( url, {
            method,
            "dispatcher": this.#dispatcher,
            signal,
            headers,
            body,
        } );

        var data;

        if ( res.ok ) {

            // stream
            if ( stream ) {
                const jsonStreamParse = new jsonStream.Parse();

                pipeline( res.body, jsonStreamParse, () => {} );

                return result( 200, jsonStreamParse );
            }

            // json data
            else {
                try {
                    data = await res.json();
                }
                catch ( e ) {
                    return result.catch( e );
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
                return result.catch( e );
            }

            return result( [ res.status, data?.message || res.statusText ] );
        }
    }

    // private
    get #dispatcher () {
        this.#_dispatcher ??= new fetch.Dispatcher( {
            "socketPath": DEFAULT_SOCKET_PATH,
        } );

        return this.#_dispatcher;
    }
}
