module.exports = Super =>
    class extends ( Super || Object ) {
        #city;

        $init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super.$init ) super.$init( url, options );

            this.city = options.city ?? url.searchParams.get( "city" );
        }

        get url () {
            const url = super.url;

            if ( this.#city ) url.searchParams.set( "city", this.#city );

            return url;
        }

        get city () {
            return this.#city;
        }

        set city ( value ) {
            value = value ? value.toLowerCase() : null;

            // not updated
            if ( value === ( this.#city || null ) ) return;

            this.#city = value;

            this._updated();
        }
    };
