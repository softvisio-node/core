export default Super =>
    class extends ( Super || Object ) {

        // https://core.telegram.org/bots/api#answerwebappquery
        async answerWebAppQuery ( data ) {
            return this._request( "answerWebAppQuery", data );
        }

        // https://core.telegram.org/bots/api#sentwebappmessage
        async sentWebAppMessage ( data ) {
            return this._request( "sentWebAppMessage", data );
        }
    };
