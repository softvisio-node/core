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

            if ( this.country ) url.searchParams.set( "country", this.country );

            return url;
        }

        get country () {
            if ( !this.#country && this.ip ) this.country = this.ip.country;

            return this.#country;
        }

        set country ( value ) {
            if ( value ) value = value.toUpperCase();
            else value = null;

            // not updated
            if ( value === ( this.#country || null ) ) return;

            this.#country = value;

            this._updated();

            this.emit( "country-updated" );
        }
    };
