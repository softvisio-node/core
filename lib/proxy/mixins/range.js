import IPRange from "#lib/ip/range";

export default Super =>
    class extends ( Super || Object ) {
        #range;

        // properties
        get range () {
            return this.#range;
        }

        set range ( value ) {
            value = value ? IPRange.new( value ) : null;

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

        _buildURL () {
            const url = super._buildURL();

            if ( this.range ) url.searchParams.set( "range", this.range.toString() );

            return url;
        }
    };
