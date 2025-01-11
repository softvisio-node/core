export default Super =>
    class extends ( Super || class {} ) {

        // https://api.cloudflare.com/#user-user-details
        async getUserDetails () {
            return this._doRequest( "get", "user" );
        }
    };
