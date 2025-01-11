export default Super =>
    class extends ( Super || class {} ) {

        // https://core.telegram.org/bots/api#sendgame
        async sendgame ( data ) {
            return this._doRequest( "sendgame", data );
        }

        // https://core.telegram.org/bots/api#setgamescore
        async setGameScore ( data ) {
            return this._doRequest( "setGameScore", data );
        }

        // https://core.telegram.org/bots/api#getgamehighscores
        async getGameHighScores ( data ) {
            return this._doRequest( "getGameHighScores", data );
        }
    };
