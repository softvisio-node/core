export default Super =>
    class extends ( Super || class {} ) {

        // https://core.telegram.org/bots/api#answerwebappquery
        async answerWebAppQuery ( data ) {
            return this._doRequest( "answerWebAppQuery", data );
        }
    };
