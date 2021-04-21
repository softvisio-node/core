const IPSubnet = require( "#lib/ip/subnet" );

module.exports = Super =>
    class extends ( Super || Object ) {
        #localSubnet;

        $init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super.$init ) super.$init( url, options );

            this.localSubnet = options.localSubnet ?? url.searchParams.get( "localSubnet" );
        }

        get url () {
            const url = super.url;

            if ( this.localSubnet ) url.searchParams.set( "localSubnet", this.localSubnet.toString() );

            return url;
        }

        get localSubnet () {
            return this.#localSubnet;
        }

        set localSubnet ( value ) {
            value = value ? IPSubnet.new( value ) : null;

            // not updated
            if ( this.#localSubnet === value ) return;

            this.#localSubnet = value;

            this._updated();
        }
    };
