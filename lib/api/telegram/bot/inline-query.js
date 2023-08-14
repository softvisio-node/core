export default Super =>
    class extends ( Super || Object ) {

        // https://core.telegram.org/bots/api#answerinlinequery
        async answerInlineQuery ( data ) {
            return this._request( "answerInlineQuery", data );
        }
    };
