module.exports = Super =>
    class extends ( Super || Object ) {
        $init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super.$init ) super.$init( url, options );

            this.resolve = options.resolve ?? url.searchParams.get( "resolve" );
        }

        get url () {
            const url = super.url;

            if ( this.resolve ) url.searchParams.set( "resolve", "true" );

            return url;
        }

        get resolve () {
            return this._options.resolve;
        }

        set resolve ( value ) {
            if ( value === "true" || value === true ) value = true;
            else value = false;

            this._set( "resolve", value );
        }

        _buildOptions ( options ) {
            const _options = super._buildOptions( options );

            if ( options.resolve ) _options.resolve = true;

            return _options;
        }
    };
