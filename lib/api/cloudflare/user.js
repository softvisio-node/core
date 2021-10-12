export default Super =>
    class extends ( Super || Object ) {

        // https://api.cloudflare.com/#user-user-details
        async getUserDetails () {
            return this._request( "get", "user" );
        }
    };
