export default Super =>
    class extends ( Super || class {} ) {

        // properties
        get direct () {
            return this._options.direct;
        }

        set direct ( value ) {
            if ( value === "true" || value === true ) value = true;
            else value = false;

            this._set( "direct", value );
        }

        // protected
        _init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super._init ) super._init( url, options );

            this.direct = options.direct ?? url.searchParams.get( "direct" );
        }

        _buildOptions ( options ) {
            const _options = super._buildOptions( options );

            if ( options.direct ) _options.direct = true;

            return _options;
        }

        _buildUrl () {
            const url = super._buildUrl();

            if ( this.direct ) url.searchParams.set( "direct", "true" );

            return url;
        }
    };
