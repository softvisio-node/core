export default Super =>
    class extends ( Super || Object ) {
        _init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super._init ) super._init( url, options );

            this.country = options.country ?? url.searchParams.get( "country" );
        }

        get url () {
            const url = super.url;

            if ( this.country ) url.searchParams.set( "country", this.country );

            return url;
        }

        // XXX get country from remote address
        get country () {
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
