export default Super =>
    class extends ( Super || Object ) {

        // https://core.telegram.org/bots/api#getwebhookinfo
        async getWebhookInfo ( data ) {
            return this._request( "getWebhookInfo", data );
        }

        // https://core.telegram.org/bots/api#setwebhook
        async setWebhook ( data ) {
            return this._request( "setWebhook", data );
        }

        // https://core.telegram.org/bots/api#deletewebhook
        async deleteWebhook ( data ) {
            return this._request( "deleteWebhook", data );
        }

        // https://core.telegram.org/bots/api#close
        async close ( data ) {
            return this._request( "close", data );
        }

        // https://core.telegram.org/bots/api#logout
        async logOut ( data ) {
            return this._request( "logOut", data );
        }
    };
