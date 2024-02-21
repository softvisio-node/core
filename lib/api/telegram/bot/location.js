export default Super =>
    class extends ( Super || class {} ) {

        // https://core.telegram.org/bots/api#sendlocation
        async sendLocation ( data ) {
            return this._request( "sendLocation", data );
        }

        // https://core.telegram.org/bots/api#editmessagelivelocation
        async editMessageLiveLocation ( data ) {
            return this._request( "editMessageLiveLocation", data );
        }

        // https://core.telegram.org/bots/api#stopmessagelivelocation
        async stopMessageLiveLocation ( data ) {
            return this._request( "stopMessageLiveLocation", data );
        }
    };
