module.exports = Super =>
    class extends ( Super || Object ) {
        $init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super.$init ) super.$init( url, options );

            this.direct = options.direct ?? url.searchParams.get( "direct" );
        }

        get url () {
            const url = super.url;

            if ( this.direct ) url.searchParams.set( "direct", "true" );

            return url;
        }

        get direct () {
            return this._options.direct;
        }

        set direct ( value ) {
            if ( value === "true" || value === true ) value = true;
            else value = false;

            this._set( "direct", value );
        }

        _buildOptions ( options ) {
            const _options = super._buildOptions( options );

            if ( options.direct ) _options.direct = true;

            return _options;
        }
    };
