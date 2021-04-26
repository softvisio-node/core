const Websocket = require( "./websocket" );

module.exports = class extends Websocket {
    #url;
    #token;
    #persistent;
    #json;
    #version;

    constructor ( url, options = {} ) {
        super( options );

        this.#persistent = options.persistent ?? true;
        this.#json = options.json ?? false;
        this.version = options.version;

        this.#setUrl( url );
        if ( typeof options.token !== "undefined" ) this.#setToken( options.token );

        if ( this.#persistent ) this._connect();
    }

    // propes
    get url () {
        return this.#url;
    }

    set url ( value ) {
        if ( this.#setUrl( value ) ) super.url = null;
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

    get json () {
        return this.#json;
    }

    get version () {
        return this.#version;
    }

    set version ( value ) {
        this.#version = value || "v1";
    }

    // public
    async call ( method, ...args ) {

        // add api version to nethod
        if ( method.charAt( 0 ) !== "/" ) {
            method = `/${this.#version}/${method}`;
        }

        if ( this.#persistent ) {
            return this._callWebsocket( method, args );
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
            this._callVoidWebsocket( method, args );
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
    // XXX return true if modified
    // XXX clear url search params
    // XXX get persistent from protocol
    // XXX json, persistent from url search params
    #setUrl ( url ) {
        url = this._resolveUrl( url );

        if ( url.username ) this.#setToken( url.username );

        url.username = "";
        url.password = "";

        this.#url = url;

        return true;
    }

    #setToken ( value ) {
        value ||= null;

        if ( this.#token === value ) return false;

        this.#token = value;

        return true;
    }
};
