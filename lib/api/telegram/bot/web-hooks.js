export default Super =>
    class extends ( Super || class {} ) {

        // https://core.telegram.org/bots/api#getwebhookinfo
        async getWebhookInfo ( data ) {
            return this._doRequest( "getWebhookInfo", data );
        }

        // https://core.telegram.org/bots/api#setwebhook
        async setWebhook ( data ) {
            return this._doRequest( "setWebhook", data );
        }

        // https://core.telegram.org/bots/api#deletewebhook
        async deleteWebhook ( data ) {
            return this._doRequest( "deleteWebhook", data );
        }

        // https://core.telegram.org/bots/api#close
        async close ( data ) {
            return this._doRequest( "close", data );
        }

        // https://core.telegram.org/bots/api#logout
        async logOut ( data ) {
            return this._doRequest( "logOut", data );
        }
    };
