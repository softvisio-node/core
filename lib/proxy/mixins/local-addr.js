import IpAddr from "#lib/ip/addr";

export default Super =>
    class extends ( Super || Object ) {
        #localAddr;
        #isLocal;

        // properties
        get isLocal () {
            if ( this.#isLocal == null ) this.#isLocal = this.localAddr && this.localAddr.toString() === this.hostname;

            return this.#isLocal;
        }

        get localAddr () {
            return this.#localAddr;
        }

        set localAddr ( value ) {
            value = value ? IpAddr.new( value ) : null;

            // not updated
            if ( this.#localAddr === value ) return;

            this.#localAddr = value;

            this._updated();
        }

        // protected
        _new ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super._new ) super._new( url, options );

            this.localAddr = options.localAddr ?? url.searchParams.get( "localAddr" );
        }

        _updated () {
            super._updated();

            this.#isLocal = null;
        }

        _buildUrl () {
            const url = super._buildUrl();

            if ( this.localAddr ) url.searchParams.set( "localAddr", this.localAddr.toString() );

            return url;
        }
    };
