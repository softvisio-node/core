const crypto = require( "crypto" );

module.exports = Super =>
    class extends ( Super || Object ) {
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
