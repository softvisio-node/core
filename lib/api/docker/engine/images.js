import glob from "#lib/glob";
import tar from "#lib/tar";
import File from "#lib/file";

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

        // XXX tag stream
        // XXX options names
        async buildImage ( context, { signal, credentials, options = {} } = {} ) {
            const files = glob( "**", {
                "cwd": context,
                "ignoreFile": ".dockerignore",
            } );

            let body = tar.create(
                {
                    "cwd": context,

                    // "gzip": true,
                    "portable": true,
                    "sync": true, // XXX async
                    "file": "data/1.tar",
                },
                files
            );
            body = new File( { "path": "data/1.tar" } );

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
