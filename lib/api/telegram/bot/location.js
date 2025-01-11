export default Super =>
    class extends ( Super || class {} ) {

        // https://core.telegram.org/bots/api#sendlocation
        async sendLocation ( data ) {
            return this._doRequest( "sendLocation", data );
        }

        // https://core.telegram.org/bots/api#editmessagelivelocation
        async editMessageLiveLocation ( data ) {
            return this._doRequest( "editMessageLiveLocation", data );
        }

        // https://core.telegram.org/bots/api#stopmessagelivelocation
        async stopMessageLiveLocation ( data ) {
            return this._doRequest( "stopMessageLiveLocation", data );
        }
    };
