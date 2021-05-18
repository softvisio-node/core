import Websocket from "./websocket.js";

const DEFAULT_MAX_CONNECTIONS = Infinity;

export default class extends Websocket {
    #url;
    #token;
    #persistent = true;
    #json = false;
    #version = "v1";
    #pongInterval = 0; // = 1000 * 40; // 40 seconds for cloudflare
    #maxConnections = DEFAULT_MAX_CONNECTIONS;

    constructor ( url, options = {} ) {
        super( options );

        this.#setUrl( url );
        if ( "token" in options ) this.#setToken( options.token );
        if ( "persistent" in options ) this.#setPersistent( options.persistent );
        if ( "json" in options ) this.json = options.json;
        if ( "version" in options ) this.version = options.version;
        if ( "pongInterval" in options ) this.#setPongInterval( options.pongInterval );
        if ( "maxConnections" in options ) this.#setMaxConnections( options.maxConnections );

        if ( this.#persistent ) this._connectWebSocket();
    }

    // url
    get url () {
        return this.#url;
    }

    set url ( value ) {
        this.#setUrl( value );

        super.url = null;
    }

    // token
    get token () {
        return this.#token;
    }

    set token ( value ) {
        if ( this.#setToken( value ) ) super.token = null;
    }

    // persistent
    get persistent () {
        return this.#persistent;
    }

    set persistent ( value ) {
        if ( this.#setPersistent( value ) ) super.persistent = null;
    }

    // json
    get json () {
        return this.#json;
    }

    set json ( value ) {
        if ( value === "true" || value === true ) value = true;
        else value = false;

        this.#json = value;

        if ( value ) this.#url.searchParams.set( "json", "true" );
    }

    // version
    get version () {
        return this.#version;
    }

    set version ( value ) {
        this.#version = value || "v1";

        if ( this.#version !== "v1" ) this.#url.searchParams.set( "version", this.#version );
    }

    // pongInterval
    get pongInterval () {
        return this.#pongInterval;
    }

    set pongInterval ( value ) {
        if ( this.#setPongInterval( value ) ) super.pongInterval = null;
    }

    // maxConnections
    get maxConnections () {
        return this.#maxConnections;
    }

    set maxConnections ( value ) {
        if ( this.#setMaxConnections( value ) ) super.maxConnections = null;
    }

    // public
    upload ( method, file, data, onProgress ) {

        // add api version to nethod
        if ( method.charAt( 0 ) !== "/" ) {
            method = `/${this.version}/${method}`;
        }

        if ( typeof data === "function" ) {
            onProgress = data;
            data = undefined;
        }

        return new this.Upload( this, method, file, data, onProgress );
    }

    // protected
    _resolveUrl ( url ) {
        return new URL( url );
    }

    // private
    #setUrl ( url ) {
        url = this._resolveUrl( url );

        this.#url = new URL( url );
        this.#url.username = "";
        this.#url.password = "";
        this.#url.search = "";
        this.#url.hash = "";

        if ( url.username ) this.#setToken( url.username );

        if ( url.searchParams.has( "persistent" ) ) {
            this.#setPersistent( url.searchParams.get( "persistent" ) );
        }
        else {
            if ( url.protocol.startsWith( "http" ) ) this.#setPersistent( false );
            else this.#setPersistent( true );
        }

        if ( url.searchParams.has( "json" ) ) this.json = url.searchParams.get( "json" );
        if ( url.searchParams.has( "version" ) ) this.version = url.searchParams.get( "version" );
        if ( url.searchParams.has( "pongInterval" ) ) this.#setPongInterval( url.searchParams.get( "pongInterval" ) );
        if ( url.searchParams.has( "maxConnections" ) ) this.#setMaxConnections( url.searchParams.get( "maxConnections" ) );
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

    #setPongInterval ( value ) {
        if ( value == null || value === false || value === "false" ) value = 0;

        value = parseInt( value );

        if ( Number.isNaN( value ) ) return;

        if ( value < 0 ) value = 0;

        if ( value === this.#pongInterval ) return;

        this.#pongInterval = value;

        if ( !value ) this.#url.searchParams.delete( "pongInterval" );
        else this.#url.searchParams.set( "pongInterval", value );

        return true;
    }

    #setMaxConnections ( value ) {
        if ( !value ) value = DEFAULT_MAX_CONNECTIONS;
        else {
            value = parseInt( value );

            if ( Number.isNaN( value ) ) return;
            if ( value < 0 ) value = DEFAULT_MAX_CONNECTIONS;
        }

        // not changed
        if ( value === this.#maxConnections ) return;

        this.#maxConnections = value;

        if ( !value || value === DEFAULT_MAX_CONNECTIONS ) this.#url.searchParams.delete( "maxConnections" );
        else this.#url.searchParams.set( "maxConnections", value );

        return true;
    }
}
