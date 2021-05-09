export default Super =>
    class extends ( Super || Object ) {
        _init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super._init ) super._init( url, options );

            this.zone = options.zone ?? url.searchParams.get( "zone" );
        }

        get url () {
            const url = super.url;

            if ( this.zone ) url.searchParams.set( "zone", this.zone );

            return url;
        }

        get zone () {
            return this._options.zone;
        }

        set zone ( value ) {
            value = value ? value.toLowerCase() : null;

            this._set( "zone", value );
        }

        _buildOptions ( options ) {
            const _options = super._buildOptions( options );

            if ( options.zone ) _options.zone = options.zone.toLowerCase();

            return _options;
        }
    };
