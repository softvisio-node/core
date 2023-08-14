export default Super =>
    class extends ( Super || Object ) {

        // https://core.telegram.org/bots/api#sendinvoice
        async sendInvoice ( data ) {
            return this._request( "sendInvoice", data );
        }

        // https://core.telegram.org/bots/api#createinvoicelink
        async createInvoiceLink ( data ) {
            return this._request( "createInvoiceLink", data );
        }

        // https://core.telegram.org/bots/api#answershippingquery
        async answerShippingQuery ( data ) {
            return this._request( "answerShippingQuery", data );
        }

        // https://core.telegram.org/bots/api#answerprecheckoutquery
        async answerPreCheckoutQuery ( data ) {
            return this._request( "answerPreCheckoutQuery", data );
        }
    };
