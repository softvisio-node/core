export default Super =>
    class extends ( Super || class {} ) {

        // https://core.telegram.org/bots/api#setpassportdataerrors
        async setPassportDataErrors ( data ) {
            return this._doRequest( "setPassportDataErrors", data );
        }
    };
