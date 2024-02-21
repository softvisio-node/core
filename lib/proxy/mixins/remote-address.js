import IpAddress from "#lib/ip/address";

export default Super =>
    class extends ( Super || class {} ) {
        #remoteAddress;

        // properties
        get remoteAddress () {
            return this.#remoteAddress;
        }

        set remoteAddress ( value ) {
            value = value ? IpAddress.new( value ) : null;

            // not updated
            if ( this.#remoteAddress === value ) return;

            this.#remoteAddress = value;

            this._updated();
        }

        // protected
        _init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super._init ) super._init( url, options );

            this.remoteAddress = options.remoteAddress ?? url.searchParams.get( "remoteAddress" );
        }

        _buildUrl () {
            const url = super._buildUrl();

            if ( this.remoteAddress ) url.searchParams.set( "remoteAddress", this.remoteAddress.toString() );

            return url;
        }
    };
