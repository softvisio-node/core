export default Super =>
    class extends Super {

        // https://core.telegram.org/bots/api#getwebhookinfo
        async getWebhookInfo () {}

        // https://core.telegram.org/bots/api#setwebhook
        async setWebhook () {}

        // https://core.telegram.org/bots/api#deletewebhook
        async deleteWebhook () {}

        // https://core.telegram.org/bots/api#close
        async close () {}

        // https://core.telegram.org/bots/api#logout
        async logOut () {}
    };
