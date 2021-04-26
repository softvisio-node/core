const Websocket = require( "./websocket" );

module.exports = class extends Websocket {
    #url;
    #token;
    #persistent = true;
    #json = false;
    #version = "v1";

    constructor ( url, options = {} ) {
        super( options );

        this.#setUrl( url );
        if ( "token" in options ) this.#setToken( options.token );
        if ( "persistent" in options ) this.#setPersistent( options.persistent );
        if ( "json" in options ) this.json = options.json;
        if ( "version" in options ) this.version = options.version;

        if ( this.#persistent ) this._connectWebSocket();
    }

    // propes
    get url () {
        return this.#url;
    }

    set url ( value ) {
        this.#setUrl( value );

        super.url = null;
    }

    get token () {
        return this.#token;
    }

    set token ( value ) {
        if ( this.#setToken( value ) ) super.token = null;
    }

    get persistent () {
        return this.#persistent;
    }

    set persistent ( value ) {
        if ( this.#setPersistent( value ) ) super.persistent = null;
    }

    get json () {
        return this.#json;
    }

    set json ( value ) {
        if ( value === "true" || value === true ) value = true;
        else value = false;

        this.#json = value;

        if ( value ) this.#url.searchParams.set( "json", "true" );
    }

    get version () {
        return this.#version;
    }

    set version ( value ) {
        this.#version = value || "v1";

        if ( this.#version !== "v1" ) this.#url.searchParams.set( "version", this.#version );
    }

    // public
    async call ( method, ...args ) {

        // add api version to nethod
        if ( method.charAt( 0 ) !== "/" ) {
            method = `/${this.#version}/${method}`;
        }

        if ( this.#persistent ) {
            return this._callWebSocket( method, args );
        }
        else {
            return this._callHttp( method, args );
        }
    }

    async callVoid ( method, ...args ) {

        // add api version to nethod
        if ( method.charAt( 0 ) !== "/" ) {
            method = `/${this.#version}/${method}`;
        }

        if ( this.#persistent ) {
            this._callVoidWebSocket( method, args );
        }
        else {
            this._callVoidHttp( method, args );
        }
    }

    // protected
    _resolveUrl ( url ) {
        return new URL( url );
    }

    // private
    #setUrl ( url ) {
        url = this.#url = this._resolveUrl( url );

        if ( url.username ) this.#setToken( url.username );

        // get persistent from search params
        let persistent = url.searchParams.get( "persistent" );

        // or get persistent from url protocol
        if ( !persistent ) {
            if ( url.protocol.startsWith( "http" ) ) persistent = false;
            else persistent = true;
        }

        const json = url.searchParams.get( "json" );
        const version = url.searchParams.get( "version" );

        // clean url
        url.username = this.token || "";
        url.password = "";
        url.search = "";
        url.hash = "";

        this.#setPersistent( persistent );
        this.json = json;
        this.version = version;
    }

    #setToken ( value ) {
        value ||= null;

        if ( this.#token === value ) return false;

        this.#token = value;

        this.#url.username = value;

        return true;
    }

    #setPersistent ( value ) {
        if ( value === "true" || value === true ) value = true;
        else value = false;

        if ( this.#persistent === value ) return false;

        this.#persistent = value;

        this.#url.searchParams.set( "persistent", value );

        return true;
    }
};
