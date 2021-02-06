const Addr = require( "../../ip/addr" );

module.exports = Super =>
    class extends ( Super || Object ) {
        #ip;

        constructor ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            super( url, options );

            this.ip = options.ip ?? url.searchParams.get( "ip" );
        }

        get url () {
            const url = super.url;

            if ( this.ip ) url.searchParams.set( "ip", this.ip.toString() );

            return url;
        }

        get ip () {
            return this.#ip;
        }

        set ip ( value ) {
            if ( value ) {
                this.#ip = new Addr( value );

                this.country = this.#ip.country;
            }
            else {
                this.#ip = null;
            }

            this._updated();
        }
    };
