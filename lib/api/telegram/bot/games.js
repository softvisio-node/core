export default Super =>
    class extends ( Super || Object ) {

        // https://core.telegram.org/bots/api#sendgame
        async sendgame () {}

        // https://core.telegram.org/bots/api#setgamescore
        async setGameScore () {}

        // https://core.telegram.org/bots/api#getgamehighscores
        async getGameHighScores () {}
    };
