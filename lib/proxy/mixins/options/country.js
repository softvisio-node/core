module.exports = Super =>
    class extends ( Super || Object ) {
        #country;

        $init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super.$init ) super.$init( url, options );

            this.country = options.country ?? url.searchParams.get( "country" );
        }

        get url () {
            const url = super.url;

            if ( this.#country ) url.searchParams.set( "country", this.#country );

            return url;
        }

        get country () {

            // get country from remote address
            if ( !this.#country && this.remoteAddr ) this.country = this.remoteAddr.country;

            return this.#country;
        }

        set country ( value ) {
            value = value ? value.toUpperCase() : null;

            // not updated
            if ( value === ( this.#country || null ) ) return;

            this.#country = value;

            this._updated();
        }
    };
