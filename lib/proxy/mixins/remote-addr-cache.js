const IPAddr = require( "../../ip/addr" );

module.exports = Super =>
    class extends ( Super || Object ) {
        #remoteAddr;

        $init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super.$init ) super.$init( url, options );

            this.remoteAddr = options.remoteAddr ?? url.searchParams.get( "remote-addr" );
        }

        get url () {
            const url = super.url;

            if ( this.#remoteAddr ) url.searchParams.set( "remote-addr", this.#remoteAddr.toString() );

            return url;
        }

        get remoteAddr () {
            return this.#remoteAddr;
        }

        set remoteAddr ( value ) {
            value = value ? IPAddr.new( value ) : null;

            // not updated
            if ( ( this.#remoteAddr || null ) + "" === value + "" ) return;

            this.#remoteAddr = value;

            this.country = null;

            this._updated();
        }
    };
