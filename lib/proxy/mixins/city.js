export default Super =>
    class extends ( Super || class {} ) {

        // properties
        get city () {
            return this._options.city;
        }

        set city ( value ) {
            value = value
                ? value.toLowerCase()
                : null;

            this._set( "city", value );
        }

        // protected
        _init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super._init ) super._init( url, options );

            this.city = options.city ?? url.searchParams.get( "city" );
        }

        _buildOptions ( options ) {
            const _options = super._buildOptions( options );

            if ( options.city ) _options.city = options.city.toLowerCase();

            return _options;
        }

        _buildUrl () {
            const url = super._buildUrl();

            if ( this.city ) url.searchParams.set( "city", this.city );

            return url;
        }
    };
