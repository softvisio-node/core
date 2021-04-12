module.exports = Super =>
    class extends ( Super || Object ) {
        #zone;

        $init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super.$init ) super.$init( url, options );

            this.zone = options.zone ?? url.searchParams.get( "zone" );
        }

        get url () {
            const url = super.url;

            if ( this.#zone ) url.searchParams.set( "zone", this.#zone );

            return url;
        }

        get zone () {
            return this.#zone;
        }

        set zone ( value ) {
            value = value ? value.toLowerCase() : null;

            // not updated
            if ( value === ( this.#zone || null ) ) return;

            this.#zone = value;

            this._updated();
        }
    };
