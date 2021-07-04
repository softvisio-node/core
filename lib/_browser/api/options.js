import Websocket from "./websocket.js";
import LRUCache from "lru-cache";

const DEFAULT_VERSION = "v1";
const DEFAULT_PONG_INTERVAL = 0;
const DEFAULT_MAX_CONNECTIONS = 1;
const DEFAULT_CACHE_MAX = 10000;
const DEFAULT_CACHE_MAX_AGE = 0;

export default class extends Websocket {
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
    #onRPC;
    #cacheMax;
    #cacheMaxAge;

    #url;
    #httpURL;
    #websocketsURL;
    #uploadURL;
    #cache;
    #cacheReset;

    init ( url, options = {} ) {
        if ( this.#initialized ) return;

        url = this._resolveURL( url );

        // XXX protocol + persistent
        this.#protocol = url.protocol;
        this.url = url;
        this.persistent = options.persistent ?? url.searchParams.get( "persistent" );

        this.token = options.token ?? url.username;
        this.json = options.json ?? url.searchParams.get( "json" );
        this.version = options.version ?? url.searchParams.get( "version" );
        this.maxConnections = options.maxConnections ?? url.searchParams.get( "maxConnections" );
        this.pongInterval = options.pongInterval ?? url.searchParams.get( "pongInterval" );
        this.#onRPC = options.onRPC;
        this.cacheMax = options.cacheMax ?? url.searchParams.get( "cacheMax" );
        this.cacheMaxAge = options.cacheMaxAge ?? url.searchParams.get( "cacheMaxAge" );

        // init cache drop events
        this.#cacheReset = new Set( options.cacheReset ?? url.searchParams.getAll( "cacheReset" ) );
        for ( const name of this.#cacheReset ) this.on( name, () => this.#cache.reset() );

        this.#initialized = true;

        // create cache
        this._cacheUpdated();

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
            if ( this.#persistent ) this.#url = this.websocketsURL;
            else this.#url = this.httpURL;
        }

        return this.#url;
    }

    set url ( value ) {
        const url = this._resolveURL( value );

        if ( url.username ) this.token = url.username;

        // not changed
        if ( this.#hostname === url.hostname && this.#port === url.port && this.#pathname === url.pathname ) return;

        this.#hostname = url.hostname;
        this.#port = url.port;
        this.#pathname = url.pathname;

        this.#optionsUpdated();
        this._urlUpdated();
    }

    get httpURL () {
        if ( !this.#httpURL ) {
            const url = this.#buildURL();

            if ( url.protocol === "ws:" ) url.protocol = "http:";
            else if ( url.protocol === "wss:" ) url.protocol = "https:";

            this.#httpURL = url.href;
        }

        return this.#httpURL;
    }

    get websocketsURL () {
        if ( !this.#websocketsURL ) {
            const url = this.#buildURL();

            if ( url.protocol === "http:" ) url.protocol = "ws:";
            else if ( url.protocol === "https:" ) url.protocol = "wss:";

            if ( this.#maxConnections !== DEFAULT_MAX_CONNECTIONS ) url.searchParams.set( "maxConnections", this.#maxConnections );
            if ( this.#pongInterval !== DEFAULT_PONG_INTERVAL ) url.searchParams.set( "pongInterval", this.#pongInterval );

            this.#websocketsURL = url.href;
        }

        return this.#websocketsURL;
    }

    get uploadURL () {
        if ( !this.#uploadURL ) {
            const url = this.#buildURL();

            if ( url.protocol === "ws:" ) url.protocol = "http:";
            else if ( url.protocol === "wss:" ) url.protocol = "https:";

            url.username = "";
            url.search = "";

            this.#uploadURL = url;
        }

        return this.#uploadURL;
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
        if ( value == null || value === "" ) value = DEFAULT_MAX_CONNECTIONS;
        else if ( value === Infinity ) value = 0;
        else value = +value;

        if ( isNaN( value ) ) value = DEFAULT_MAX_CONNECTIONS;
        else if ( value < 0 ) value = DEFAULT_MAX_CONNECTIONS;

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
        if ( value == null || value === "" ) value = DEFAULT_PONG_INTERVAL;
        else value = +value;

        if ( isNaN( value ) ) value = DEFAULT_PONG_INTERVAL;
        else if ( value < 0 ) value = DEFAULT_PONG_INTERVAL;

        // not changed
        if ( this.#pongInterval === value ) return;

        this.#pongInterval = value;

        this.#optionsUpdated();
        this._pongIntervalUpdated();
    }

    get onRPC () {
        return this.#onRPC;
    }

    set onRPC ( value ) {
        this.#onRPC = value;
    }

    get cacheMax () {
        return this.#cacheMax;
    }

    set cacheMax ( value ) {
        if ( value == null || value === "" ) value = DEFAULT_CACHE_MAX;
        else value = +value;

        if ( isNaN( value ) ) value = DEFAULT_CACHE_MAX;
        else if ( value < 0 ) value = DEFAULT_CACHE_MAX;

        // not changed
        if ( this.#cacheMax === value ) return;

        this.#cacheMax = value;

        this.#optionsUpdated();
        this._cacheUpdated();
    }

    get cacheMaxAge () {
        return this.#cacheMaxAge;
    }

    set cacheMaxAge ( value ) {
        if ( value == null || value === "" ) value = DEFAULT_CACHE_MAX_AGE;
        else value = +value;

        if ( isNaN( value ) ) value = DEFAULT_CACHE_MAX_AGE;

        // not changed
        if ( this.#cacheMaxAge === value ) return;

        this.#cacheMaxAge = value;

        this.#optionsUpdated();
        this._cacheUpdated();
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

    _cacheUpdated () {
        if ( !this.#initialized ) return;

        this.#cache = new LRUCache( {
            "max": this.#cacheMax,
            "maxAge": this.#cacheMaxAge,
        } );
    }

    // private
    #optionsUpdated () {
        this.#url = null;
        this.#httpURL = null;
        this.#websocketsURL = null;
        this.#uploadURL = null;
    }

    #buildURL () {
        const url = new URL( this.#protocol + "//" + this.#hostname );

        url.port = this.#port;
        url.pathname = this.#pathname;
        if ( this.#token ) url.username = this.#token;
        if ( this.#version !== DEFAULT_VERSION ) url.searchParams.set( "version", this.#version );
        if ( this.#json ) url.searchParams.set( "json", "true" );
        if ( this.#cacheMax !== DEFAULT_CACHE_MAX ) url.searchParams.set( "cacheMax", this.#cacheMax );
        if ( this.#cacheMaxAge !== DEFAULT_CACHE_MAX_AGE ) url.searchParams.set( "cacheMaxAge", this.#cacheMaxAge );

        for ( const name of this.#cacheReset ) url.searchParams.append( "cacheReset", name );

        url.searchParams.sort();

        return url;
    }
}
