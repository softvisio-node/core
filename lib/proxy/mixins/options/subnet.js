const IPSubnet = require( "#lib/ip/subnet" );

module.exports = Super =>
    class extends ( Super || Object ) {
        #subnet;

        $init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super.$init ) super.$init( url, options );

            this.subnet = options.subnet ?? url.searchParams.get( "subnet" );
        }

        get url () {
            const url = super.url;

            if ( this.subnet ) url.searchParams.set( "subnet", this.subnet.toString() );

            return url;
        }

        get subnet () {
            return this.#subnet;
        }

        set subnet ( value ) {
            value = value ? IPSubnet.new( value ) : null;

            // not updated
            if ( this.#subnet === value ) return;

            this.#subnet = value;

            this._updated();
        }
    };
