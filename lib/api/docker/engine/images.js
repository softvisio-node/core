export default Super =>
    class extends ( Super || Object ) {
        async getImages () {
            return this._request( "get", "images/json" );
        }

        async pruneImages ( filters ) {
            return this._request( "post", "images/prune", { filters } );
        }
    };
