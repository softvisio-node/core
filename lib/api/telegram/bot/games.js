export default Super =>
    class extends ( Super || class {} ) {

        // https://core.telegram.org/bots/api#sendgame
        async sendgame ( data ) {
            return this._request( "sendgame", data );
        }

        // https://core.telegram.org/bots/api#setgamescore
        async setGameScore ( data ) {
            return this._request( "setGameScore", data );
        }

        // https://core.telegram.org/bots/api#getgamehighscores
        async getGameHighScores ( data ) {
            return this._request( "getGameHighScores", data );
        }
    };
