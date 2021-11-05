export default Super =>
    class extends ( Super || Object ) {
        async getImages () {
            return this._request( "images/json" );
        }
    };
