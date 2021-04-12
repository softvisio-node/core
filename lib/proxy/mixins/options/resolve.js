module.exports = Super =>
    class extends ( Super || Object ) {
        #resolve = false;

        $init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super.$init ) super.$init( url, options );

            this.resolve = options.resolve ?? url.searchParams.get( "resolve" );
        }

        get url () {
            const url = super.url;

            if ( this.#resolve ) url.searchParams.set( "resolve", "true" );

            return url;
        }

        get resolve () {
            return this.#resolve;
        }

        set resolve ( value ) {
            if ( value === "true" || value === true ) value = true;
            else value = false;

            // not updated
            if ( value === this.#resolve ) return;

            this.#resolve = value;

            this._updated();
        }
    };
