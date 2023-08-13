export default Super =>
    class extends Super {

        // https://core.telegram.org/bots/api#sendinvoice
        async sendInvoice () {}

        // https://core.telegram.org/bots/api#createinvoicelink
        async createInvoiceLink () {}

        // https://core.telegram.org/bots/api#answershippingquery
        async answerShippingQuery () {}

        // https://core.telegram.org/bots/api#answerprecheckoutquery
        async answerPreCheckoutQuery () {}
    };
