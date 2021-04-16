const crypto = require( "crypto" );

module.exports = Super =>
    class extends ( Super || Object ) {
        #session = false;

        $init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super.$init ) super.$init( url, options );

            this.session = options.session ?? url.searchParams.get( "session" );
        }

        get url () {
            const url = super.url;

            if ( this.#session ) url.searchParams.set( "session", this.#session );

            return url;
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
