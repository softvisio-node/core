export default Super =>
    class extends ( Super || class {} ) {

        // https://core.telegram.org/bots/api#sendinvoice
        async sendInvoice ( data ) {
            return this._doRequest( "sendInvoice", data );
        }

        // https://core.telegram.org/bots/api#createinvoicelink
        async createInvoiceLink ( data ) {
            return this._doRequest( "createInvoiceLink", data );
        }

        // https://core.telegram.org/bots/api#answershippingquery
        async answerShippingQuery ( data ) {
            return this._doRequest( "answerShippingQuery", data );
        }

        // https://core.telegram.org/bots/api#answerprecheckoutquery
        async answerPreCheckoutQuery ( data ) {
            return this._doRequest( "answerPreCheckoutQuery", data );
        }
    };
