module.exports = Super =>
    class extends ( Super || Object ) {
        #state;

        $init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super.$init ) super.$init( url, options );

            this.state = options.state ?? url.searchParams.get( "state" );
        }

        get url () {
            const url = super.url;

            if ( this.#state ) url.searchParams.set( "state", this.#state );

            return url;
        }

        get state () {
            return this.#state;
        }

        set state ( value ) {
            value = value ? value.toLowerCase() : null;

            // not updated
            if ( value === ( this.#state || null ) ) return;

            this.#state = value;

            this._updated();
        }
    };
