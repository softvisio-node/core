import glob from "#lib/glob";
import tar from "#lib/tar";

export default Super =>
    class extends ( Super || Object ) {
        async getImages () {
            return this._request( "get", "images/json" );
        }

        async pruneImages ( { tagged, until } = {} ) {
            const filters = {};

            if ( tagged ) filters.dangling = ["false"];
            if ( until ) filters.until = [until];

            return this._request( "post", "images/prune", {
                "params": {
                    filters,
                },
                "jsonParams": true,
            } );
        }

        async pushImage ( image, { signal, credentials } ) {
            var tag;

            [image, tag] = image.split( ":" );

            return this._request( "post", `images/${encodeURIComponent( image )}/push`, {
                signal,
                "params": {
                    tag,
                },
                "registryAuth": await this._getImageAuth( image, credentials ),
            } );
        }

        async deleteImage ( image ) {
            return this._request( "delete", `images/${encodeURIComponent( image )}`, {
                "params": {
                    "force": false,
                    "noprune": false,
                },
            } );
        }

        // XXX options names
        async buildImage ( context, { signal, credentials, options = {} } = {} ) {
            const files = glob( "**", {
                "cwd": context,
                "ignoreFile": ".dockerignore",
            } );

            const body = tar.create(
                {
                    "cwd": context,
                    "gzip": false,
                    "portable": true,
                    "sync": false,
                },
                files
            );

            if ( typeof credentials === "function" ) {
                credentials = await credentials();
            }

            return this._request( "post", "build", {
                signal,
                "params": options,
                body,
                "registryConfig": credentials,
            } );
        }
    };
