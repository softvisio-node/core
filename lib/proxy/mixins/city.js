export default Super =>
    class extends ( Super || Object ) {
        _init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super._init ) super._init( url, options );

            this.city = options.city ?? url.searchParams.get( "city" );
        }

        get url () {
            const url = super.url;

            if ( this.city ) url.searchParams.set( "city", this.city );

            return url;
        }

        get city () {
            return this._options.city;
        }

        set city ( value ) {
            value = value ? value.toLowerCase() : null;

            this._set( "city", value );
        }

        _buildOptions ( options ) {
            const _options = super._buildOptions( options );

            if ( options.city ) _options.city = options.city.toLowerCase();

            return _options;
        }
    };
