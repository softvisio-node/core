const crypto = require( "crypto" );

module.exports = Super =>
    class extends ( Super || Object ) {
        #session = false;

        _initSession ( searchParams ) {
            const session = searchParams.get( "session" );

            return session === "" ? true : session;
        }

        get session () {
            return this.#session;
        }

        set session ( value ) {
            if ( value ) {
                if ( value === true || value === "true" ) value = this._generateSession();
            }
            else {
                value = false;
            }

            // not updated
            if ( value === this.#session ) return;

            this.#session = value;

            this._updated();
        }

        _generateSession () {
            return crypto.randomBytes( 16 ).toString( "base64url" );
        }
    };
