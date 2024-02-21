export default Super =>
    class extends ( Super || class {} ) {

        // https://api.cloudflare.com/#accounts-list-accounts
        async getAccounts () {
            return this._request( "get", "accounts" );
        }
    };
