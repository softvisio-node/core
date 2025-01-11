export default Super =>
    class extends ( Super || class {} ) {

        // https://core.telegram.org/bots/api#sendpoll
        async sendPoll ( data ) {
            return this._doRequest( "sendPoll", data );
        }

        // https://core.telegram.org/bots/api#stoppoll
        async stopPoll ( data ) {
            return this._doRequest( "stopPoll", data );
        }
    };
