import WebSocket from "./websocket.js";
import CacheLru from "#lib/cache-lru";

const DEFAULT_VERSION = "v1";
const DEFAULT_PONG_INTERVAL = 0;
const DEFAULT_MAX_CONNECTIONS = 1;
const DEFAULT_CACHE_MAX_SIZE = 10000;
const DEFAULT_CACHE_MAX_AGE = 0;

export default class extends WebSocket {
    #initialized;

    #protocol;
    #hostname;
    #port;
    #pathname = "/";
    #persistent;
    #token;
    #json;
    #version;
    #maxConnections;
    #pongInterval;
    #onRpc;

    #url;
    #httpUrl;
    #websocketsUrl;
    #uploadUrl;
    #cache;
    #cacheReset;

    init ( url, options = {} ) {
        if ( this.#initialized ) return;

        this.#cache = new CacheLru( {
            "maxSize": DEFAULT_CACHE_MAX_SIZE,
            "maxAge": DEFAULT_CACHE_MAX_AGE,
        } ).on( "option", option => {
            if ( option === "maxSize" || option === "maxAge" ) this.#optionsUpdated();
        } );

        url = this._resolveUrl( url );

        this.#protocol = url.protocol;
        this.url = url;
        this.persistent = options.persistent ?? url.searchParams.get( "persistent" );

        this.token = options.token ?? url.username;
        this.json = options.json ?? url.searchParams.get( "json" );
        this.version = options.version ?? url.searchParams.get( "version" );
        this.maxConnections = options.maxConnections ?? url.searchParams.get( "maxConnections" );
        this.pongInterval = options.pongInterval ?? url.searchParams.get( "pongInterval" );
        this.#onRpc = options.onRpc;
        this.#cache.maxSize = ( options.cacheMaxSize ?? +url.searchParams.get( "cacheMaxSize" ) ) || DEFAULT_CACHE_MAX_SIZE;
        this.#cache.maxAge = ( options.cacheMaxAge ?? +url.searchParams.get( "cacheMaxAge" ) ) || DEFAULT_CACHE_MAX_AGE;

        // init cache drop events
        this.#cacheReset = new Set( options.cacheReset ?? url.searchParams.getAll( "cacheReset" ) );
        for ( const name of this.#cacheReset ) this.on( name, () => this.#cache.reset() );

        this.#initialized = true;

        // start persistent connection
        if ( this.persistent ) this._connectWebSocket();
    }

    get protocol () {
        return this.#protocol;
    }

    get hostname () {
        return this.#hostname;
    }

    get port () {
        return this.#port;
    }

    get pathname () {
        return this.#pathname;
    }

    get url () {
        if ( !this.#url ) {
            if ( this.#persistent ) this.#url = this.websocketsUrl;
            else this.#url = this.httpUrl;
        }

        return this.#url;
    }

    set url ( value ) {
        const url = this._resolveUrl( value );

        if ( url.username ) this.token = url.username;

        // not changed
        if ( this.#hostname === url.hostname && this.#port === url.port && this.#pathname === url.pathname ) return;

        this.#hostname = url.hostname;
        this.#port = url.port;
        this.#pathname = url.pathname;

        this.#optionsUpdated();
        this._urlUpdated();
    }

    get httpUrl () {
        if ( !this.#httpUrl ) {
            const url = this.#buildUrl();

            if ( url.protocol === "ws:" ) url.protocol = "http:";
            else if ( url.protocol === "wss:" ) url.protocol = "https:";

            this.#httpUrl = url.href;
        }

        return this.#httpUrl;
    }

    get websocketsUrl () {
        if ( !this.#websocketsUrl ) {
            const url = this.#buildUrl();

            if ( url.protocol === "http:" ) url.protocol = "ws:";
            else if ( url.protocol === "https:" ) url.protocol = "wss:";

            if ( this.#maxConnections !== DEFAULT_MAX_CONNECTIONS ) url.searchParams.set( "maxConnections", this.#maxConnections );
            if ( this.#pongInterval !== DEFAULT_PONG_INTERVAL ) url.searchParams.set( "pongInterval", this.#pongInterval );

            this.#websocketsUrl = url.href;
        }

        return this.#websocketsUrl;
    }

    get uploadUrl () {
        if ( !this.#uploadUrl ) {
            const url = this.#buildUrl();

            if ( url.protocol === "ws:" ) url.protocol = "http:";
            else if ( url.protocol === "wss:" ) url.protocol = "https:";

            url.username = "";
            url.search = "";

            this.#uploadUrl = url;
        }

        return this.#uploadUrl;
    }

    get persistent () {
        return this.#persistent;
    }

    set persistent ( value ) {
        if ( value == null || value === "" ) {
            if ( this.#protocol.startsWith( "ws" ) ) value = true;
            else value = false;
        }
        else {
            value = value === true || value === "true";
        }

        // not changed
        if ( this.#persistent === value ) return;

        this.#persistent = value;

        // change protocol
        if ( this.#persistent ) {
            if ( this.#protocol === "http:" ) this.#protocol = "ws:";
            else if ( this.#protocol === "https:" ) this.#protocol = "wss:";
        }
        else {
            if ( this.#protocol === "ws:" ) this.#protocol = "http:";
            else if ( this.#protocol === "wss:" ) this.#protocol = "https:";
        }

        this.#optionsUpdated();
        this._persistentUpdated();
    }

    get token () {
        return this.#token;
    }

    set token ( value ) {
        value ||= null;

        // not changed
        if ( this.#token === value ) return;

        this.#token = value;

        this.#optionsUpdated();
        this._tokenUpdated();
    }

    get json () {
        return this.#json;
    }

    set json ( value ) {
        value = value === true || value === "true";

        this.#json = value;

        this.#optionsUpdated();
    }

    get version () {
        return this.#version;
    }

    set version ( value ) {
        value ||= DEFAULT_VERSION;

        this.#version = value;

        this.#optionsUpdated();
    }

    get maxConnections () {
        return this.#maxConnections;
    }

    set maxConnections ( value ) {
        value = parseInt( value );
        if ( isNaN( value ) || value < 0 ) value = DEFAULT_MAX_CONNECTIONS;

        // not changed
        if ( this.#maxConnections === value ) return;

        this.#maxConnections = value;

        this.#optionsUpdated();
        this._maxConnectionsUpdated();
    }

    get pongInterval () {
        return this.#pongInterval;
    }

    set pongInterval ( value ) {
        value = parseInt( value );
        if ( isNaN( value ) || value < 0 ) value = DEFAULT_PONG_INTERVAL;

        // not changed
        if ( this.#pongInterval === value ) return;

        this.#pongInterval = value;

        this.#optionsUpdated();
        this._pongIntervalUpdated();
    }

    get onRpc () {
        return this.#onRpc;
    }

    set onRpc ( value ) {
        this.#onRpc = value;
    }

    get cache () {
        return this.#cache;
    }

    // protected
    _urlUpdated () {
        if ( !this.#initialized ) return;

        super._urlUpdated();
    }

    _persistentUpdated () {
        if ( !this.#initialized ) return;

        super._persistentUpdated();
    }

    _tokenUpdated () {
        if ( !this.#initialized ) return;

        super._tokenUpdated();
    }

    _maxConnectionsUpdated () {
        if ( !this.#initialized ) return;

        if ( !this.persistent ) return;

        super._maxConnectionsUpdated();
    }

    _pongIntervalUpdated () {
        if ( !this.#initialized ) return;

        if ( !this.persistent ) return;

        super._pongIntervalUpdated();
    }

    // private
    #optionsUpdated () {
        this.#url = null;
        this.#httpUrl = null;
        this.#websocketsUrl = null;
        this.#uploadUrl = null;
    }

    #buildUrl () {
        const url = new URL( this.#protocol + "//" + this.#hostname );

        url.port = this.#port;
        url.pathname = this.#pathname;
        if ( this.#token ) url.username = this.#token;
        if ( this.#version !== DEFAULT_VERSION ) url.searchParams.set( "version", this.#version );
        if ( this.#json ) url.searchParams.set( "json", "true" );
        if ( this.#cache.maxSize !== DEFAULT_CACHE_MAX_SIZE ) url.searchParams.set( "cacheMaxSize", +this.#cache.maxSize );
        if ( this.#cache.maxAge !== DEFAULT_CACHE_MAX_AGE ) url.searchParams.set( "cacheMaxAge", +this.#cache.maxAge );

        for ( const name of this.#cacheReset ) url.searchParams.append( "cacheReset", name );

        url.searchParams.sort();

        return url;
    }
}
