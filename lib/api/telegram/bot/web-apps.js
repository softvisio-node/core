export default Super =>
    class extends Super {

        // https://core.telegram.org/bots/api#answerwebappquery
        async answerWebAppQuery () {}

        // https://core.telegram.org/bots/api#sentwebappmessage
        async sentWebAppMessage () {}
    };
