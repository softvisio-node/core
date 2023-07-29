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

        async pushImage ( image, { username, password } ) {
            var tag;

            [image, tag] = image.split( ":" );

            var auth;

            if ( username ) {
                auth = {
                    username,
                    password,
                };
            }

            return this._stream( "post", `images/${encodeURIComponent( image )}/push`, {
                "params": {
                    tag,
                    auth,
                },
            } );
        }
    };
