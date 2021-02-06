const Addr = require( "../../ip/addr" );

module.exports = Super =>
    class extends ( Super || Object ) {
        #ip;

        $init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super.$init ) super.$init( url, options );

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
            var updated;

            if ( value ) {
                updated = this.#ip && this.#ip.toString() !== value;

                this.#ip = new Addr( value );
            }
            else {
                updated = this.#ip !== value;

                this.#ip = null;
            }

            this.country = null;

            if ( updated ) this._updated();
        }
    };
