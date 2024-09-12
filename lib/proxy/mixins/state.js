export default Super =>
    class extends ( Super || class {} ) {

        // properties
        get state () {
            return this._options.state;
        }

        set state ( value ) {
            value = value
                ? value.toLowerCase()
                : null;

            this._set( "state", value );
        }

        // protected
        _init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super._init ) super._init( url, options );

            this.state = options.state ?? url.searchParams.get( "state" );
        }

        _buildOptions ( options ) {
            const _options = super._buildOptions( options );

            if ( options.state ) _options.state = options.state.toLowerCase();

            return _options;
        }

        _buildUrl () {
            const url = super._buildUrl();

            if ( this.state ) url.searchParams.set( "state", this.state );

            return url;
        }
    };
