import IPAddr from "#lib/ip/addr";

export default Super =>
    class extends ( Super || Object ) {
        #remoteAddr;

        $init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super.$init ) super.$init( url, options );

            this.remoteAddr = options.remoteAddr ?? url.searchParams.get( "remoteAddr" );
        }

        get url () {
            const url = super.url;

            if ( this.remoteAddr ) url.searchParams.set( "remoteAddr", this.remoteAddr.toString() );

            return url;
        }

        get remoteAddr () {
            return this.#remoteAddr;
        }

        set remoteAddr ( value ) {
            value = value ? IPAddr.new( value ) : null;

            // not updated
            if ( this.#remoteAddr === value ) return;

            this.#remoteAddr = value;

            this._updated();

            this.country = null;
        }
    };
