const crypto = require( "crypto" );

module.exports = Super =>
    class extends ( Super || Object ) {
        $init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super.$init ) super.$init( url, options );

            this.session = options.session ?? url.searchParams.get( "session" );
        }

        get url () {
            const url = super.url;

            if ( this.session ) url.searchParams.set( "session", this.session );

            return url;
        }

        get session () {
            return this._options.session;
        }

        set session ( value ) {
            if ( value ) {
                if ( value === true || value === "true" ) value = this._generateSession();
            }
            else {
                value = null;
            }

            this._set( "session", value );
        }

        _buildOptions ( options ) {
            const _options = super._buildOptions( options );

            if ( options.session ) {
                if ( options.session === true || options.session === "true" ) _options.session = this._generateSession();
                else _options.session = options.session;
            }

            return _options;
        }

        _generateSession () {
            return crypto.randomBytes( 16 ).toString( "base64url" );
        }
    };
