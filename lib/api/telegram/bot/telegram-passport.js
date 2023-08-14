export default Super =>
    class extends ( Super || Object ) {

        // https://core.telegram.org/bots/api#setpassportdataerrors
        async setPassportDataErrors ( data ) {
            return this._request( "setPassportDataErrors", data );
        }
    };
