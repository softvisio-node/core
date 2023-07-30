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

        async pushImage ( image, { signal, auth } ) {
            var tag;

            [image, tag] = image.split( ":" );

            if ( typeof auth === "function" ) {
                auth = await auth( image );
            }

            return this._request( "post", `images/${encodeURIComponent( image )}/push`, {
                signal,
                "params": {
                    tag,
                },
                auth,
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

        // XXX
        async buildImage ( context, { signal, auth, options = {} } = {} ) {
            const files = glob( "**", {
                "cwd": context,
                "ignoreFile": ".dockerignore",
            } );

            let body = tar.create(
                {
                    "cwd": context,
                    "gzip": true,
                    "portable": true,
                    "sync": true, // XXX async
                    "file": "1.tar.gz",
                },
                files
            );
            body = new File( { "path": "1.tar" } );

            if ( typeof auth === "function" ) {
                auth = await auth();
            }

            return this._request( "post", "build", {
                signal,
                "params": options,
                body,
                auth,
            } );
        }
    };
