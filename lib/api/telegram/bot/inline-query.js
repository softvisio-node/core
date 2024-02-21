export default Super =>
    class extends ( Super || class {} ) {

        // https://core.telegram.org/bots/api#answerinlinequery
        async answerInlineQuery ( data ) {
            return this._request( "answerInlineQuery", data );
        }
    };
