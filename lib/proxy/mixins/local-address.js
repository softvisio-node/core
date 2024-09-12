import IpAddress from "#lib/ip/address";

export default Super =>
    class extends ( Super || class {} ) {
        #localAddress;
        #isLocal;

        // properties
        get isLocal () {
            this.#isLocal ??= this.localAddress && this.localAddress.toString() === this.hostname;

            return this.#isLocal;
        }

        get localAddress () {
            return this.#localAddress;
        }

        set localAddress ( value ) {
            value = value
                ? IpAddress.new( value )
                : null;

            // not updated
            if ( this.#localAddress === value ) return;

            this.#localAddress = value;

            this._updated();
        }

        // protected
        _init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super._init ) super._init( url, options );

            this.localAddress = options.localAddress ?? url.searchParams.get( "localAddress" );
        }

        _updated () {
            super._updated();

            this.#isLocal = null;
        }

        _buildUrl () {
            const url = super._buildUrl();

            if ( this.localAddress ) url.searchParams.set( "localAddress", this.localAddress.toString() );

            return url;
        }
    };
