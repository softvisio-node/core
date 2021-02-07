const IPAddr = require( "../../ip/addr" );

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
            value ||= null;

            var updated;

            if ( value ) {
                updated = this.#ip && this.#ip.toString() !== value;

                if ( !updated ) return;

                this.#ip = new IPAddr( value );
            }
            else {
                updated = ( this.#ip || null ) !== value;

                if ( !updated ) return;

                this.#ip = null;
            }

            this.country = null;

            this._updated();
        }
    };
