export default Super =>
    class extends ( Super || Object ) {

        // properties
        // XXX get country from remote address
        get country () {
            return this._options.country;
        }

        set country ( value ) {
            value = value ? value.toLowerCase() : null;

            this._set( "country", value );
        }

        // protected
        _new ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super._new ) super._new( url, options );

            this.country = options.country ?? url.searchParams.get( "country" );
        }

        _buildOptions ( options ) {
            const _options = super._buildOptions( options );

            if ( options.country ) _options.country = options.country.toLowerCase();

            return _options;
        }

        _buildUrl () {
            const url = super._buildUrl();

            if ( this.country ) url.searchParams.set( "country", this.country );

            return url;
        }
    };
