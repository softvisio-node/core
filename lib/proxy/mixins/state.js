export default Super =>
    class extends ( Super || Object ) {
        _init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super._init ) super._init( url, options );

            this.state = options.state ?? url.searchParams.get( "state" );
        }

        get url () {
            const url = super.url;

            if ( this.state ) url.searchParams.set( "state", this.state );

            return url;
        }

        get state () {
            return this._options.state;
        }

        set state ( value ) {
            value = value ? value.toLowerCase() : null;

            this._set( "state", value );
        }

        _buildOptions ( options ) {
            const _options = super._buildOptions( options );

            if ( options.state ) _options.state = options.state.toLowerCase();

            return _options;
        }
    };
