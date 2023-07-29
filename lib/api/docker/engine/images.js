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
    };
