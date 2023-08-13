export default Super =>
    class extends ( Super || Object ) {

        // https://core.telegram.org/bots/api#answerwebappquery
        async answerWebAppQuery () {}

        // https://core.telegram.org/bots/api#sentwebappmessage
        async sentWebAppMessage () {}
    };
