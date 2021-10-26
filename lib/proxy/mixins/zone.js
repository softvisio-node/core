export default Super =>
    class extends ( Super || Object ) {

        // properties
        get zone () {
            return this._options.zone;
        }

        set zone ( value ) {
            value = value ? value.toLowerCase() : null;

            this._set( "zone", value );
        }

        // protected
        _new ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super._new ) super._new( url, options );

            this.zone = options.zone ?? url.searchParams.get( "zone" );
        }

        _buildOptions ( options ) {
            const _options = super._buildOptions( options );

            if ( options.zone ) _options.zone = options.zone.toLowerCase();

            return _options;
        }

        _buildUrl () {
            const url = super._buildUrl();

            if ( this.zone ) url.searchParams.set( "zone", this.zone );

            return url;
        }
    };
