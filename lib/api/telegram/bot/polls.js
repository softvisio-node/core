export default Super =>
    class extends ( Super || Object ) {

        // https://core.telegram.org/bots/api#sendpoll
        async sendPoll () {}

        // https://core.telegram.org/bots/api#stoppoll
        async stopPoll () {}
    };
