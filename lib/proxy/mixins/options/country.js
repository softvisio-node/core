module.exports = Super =>
    class extends ( Super || Object ) {
        $init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super.$init ) super.$init( url, options );

            this.country = options.country ?? url.searchParams.get( "country" );
        }

        get url () {
            const url = super.url;

            if ( this.country ) url.searchParams.set( "country", this.country );

            return url;
        }

        get country () {

            // get country from remote address
            if ( !this._options.country && this.remoteAddr ) this.country = this.remoteAddr.country;

            return this._options.country;
        }

        set country ( value ) {
            value = value ? value.toLowerCase() : null;

            this._set( "country", value );
        }

        _buildOptions ( options ) {
            const _options = super._buildOptions( options );

            if ( options.country ) _options.country = options.country.toLowerCase();

            return _options;
        }
    };
