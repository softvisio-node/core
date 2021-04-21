const IPAddr = require( "../../../ip/addr" );

module.exports = Super =>
    class extends ( Super || Object ) {
        #localAddr;

        $init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super.$init ) super.$init( url, options );

            this.localAddr = options.localAddr ?? url.searchParams.get( "localAddr" );
        }

        get url () {
            const url = super.url;

            if ( this.localAddr ) url.searchParams.set( "localAddr", this.localAddr.toString() );

            return url;
        }

        get localAddr () {
            return this.#localAddr;
        }

        set localAddr ( value ) {
            value = value ? IPAddr.new( value ) : null;

            // not updated
            if ( this.#localAddr === value ) return;

            this.#localAddr = value;

            this._updated();
        }
    };
