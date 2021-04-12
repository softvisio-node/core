module.exports = Super =>
    class extends ( Super || Object ) {
        #direct = false;

        $init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super.$init ) super.$init( url, options );

            this.direct = options.direct ?? url.searchParams.get( "direct" );
        }

        get url () {
            const url = super.url;

            if ( this.#direct ) url.searchParams.set( "direct", "true" );

            return url;
        }

        get direct () {
            return this.#direct;
        }

        set direct ( value ) {
            if ( value === "true" || value === true ) value = true;
            else value = false;

            // not updated
            if ( value === this.#direct ) return;

            this.#direct = value;

            this._updated();
        }
    };
