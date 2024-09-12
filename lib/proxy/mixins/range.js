import IpRange from "#lib/ip/range";

export default Super =>
    class extends ( Super || class {} ) {
        #range;

        // properties
        get range () {
            return this.#range;
        }

        set range ( value ) {
            value = value
                ? IpRange.new( value )
                : null;

            // not updated
            if ( this.#range === value ) return;

            this.#range = value;

            this._updated();
        }

        // protected
        _init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super._init ) super._init( url, options );

            this.range = options.range ?? url.searchParams.get( "range" );
        }

        _buildUrl () {
            const url = super._buildUrl();

            if ( this.range ) url.searchParams.set( "range", this.range.toString() );

            return url;
        }
    };
