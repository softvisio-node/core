export default Super =>
    class extends ( Super || Object ) {

        // https://core.telegram.org/bots/api#sendlocation
        async sendLocation () {}

        // https://core.telegram.org/bots/api#editmessagelivelocation
        async editMessageLiveLocation () {}

        // https://core.telegram.org/bots/api#stopmessagelivelocation
        async stopMessageLiveLocation () {}
    };
