import WebSocket from "./websocket.js";
import CacheLru from "#lib/cache/lru";

const DEFAULT_VERSION = "v1";
const DEFAULT_PONG_INTERVAL = 0;
const DEFAULT_MAX_CONNECTIONS = 1;
const DEFAULT_CACHE_MAX_SIZE = 10000;
const DEFAULT_CACHE_MAX_AGE = 0;

export default class extends WebSocket {
    #protocol;
    #hostname;
    #port;
    #pathname = "/";
    #persistent;
    #token;
    #version;
    #maxConnections;
    #pongInterval;
    #onRpc;

    #url;
    #httpUrl;
    #websocketsUrl;
    #uploadUrl;
    #cache;
    #clearCacheOn = new Set();

    constructor ( url, options = {} ) {
        super();

        url = this._resolveUrl( url );

        this.#protocol = url.protocol;
        this.#hostname = url.hostname;
        this.#port = url.port;
        this.#pathname = url.pathname;

        // token
        this.#token = ( options.token ?? url.username ) || null;

        // persistent
        this.#persistent = options.persistent ?? url.searchParams.get( "persistent" );
        if ( this.#persistent == null || this.#persistent === "" ) {
            this.#persistent = this.#protocol.startsWith( "ws" );
        }
        else {
            this.#persistent = this.#persistent === true || this.#persistent === "true";
        }

        // set protocol according to the persistent value
        if ( this.#persistent ) {
            if ( this.#protocol === "http:" ) this.#protocol = "ws:";
            else if ( this.#protocol === "https:" ) this.#protocol = "wss:";
        }
        else {
            if ( this.#protocol === "ws:" ) this.#protocol = "http:";
            else if ( this.#protocol === "wss:" ) this.#protocol = "https:";
        }

        // version
        this.#version = ( options.version ?? url.searchParams.get( "version" ) ) || DEFAULT_VERSION;

        // maxConnections
        this.#maxConnections = parseInt( options.maxConnections ?? url.searchParams.get( "maxConnections" ) );
        if ( isNaN( this.#maxConnections ) || this.#maxConnections <= 0 ) this.#maxConnections = DEFAULT_MAX_CONNECTIONS;

        // pongInterval
        this.#pongInterval = parseInt( options.pongInterval ?? url.searchParams.get( "pongInterval" ) );
        if ( isNaN( this.#pongInterval ) || this.#pongInterval < 0 ) this.#pongInterval = DEFAULT_PONG_INTERVAL;

        // onRpc
        this.#onRpc = options.onRpc;

        // cache
        var cacheMaxSize = parseInt( options.cacheMaxSize ?? url.searchParams.get( "cacheMaxSize" ) );
        if ( isNaN( cacheMaxSize ) || cacheMaxSize <= 0 ) cacheMaxSize = DEFAULT_CACHE_MAX_SIZE;

        var cacheMaxAge = parseInt( options.cacheMaxAge ?? url.searchParams.get( "cacheMaxAge" ) );
        if ( isNaN( cacheMaxAge ) ) cacheMaxAge = DEFAULT_CACHE_MAX_AGE;

        this.#cache = new CacheLru( {
            "maxSize": cacheMaxSize,
            "maxAge": cacheMaxAge,
        } );

        // cache drop events
        new Set( options.clearCacheOn ?? url.searchParams.getAll( "clearCacheOn" ) ).forEach( name => {
            name.split( "," ).forEach( name => {
                name = name.trim();

                if ( this.#clearCacheOn.has( name ) ) return;

                this.#clearCacheOn.add( name );

                this.on( name, () => this.#cache.clear() );
            } );
        } );
    }

    // static
    static new ( url, options ) {
        if ( url instanceof this ) return url;

        const api = new this( url, options );

        // start persistent connection
        if ( api.persistent ) api._connectWebSocket();

        return api;
    }

    // properties
    get api () {
        return this;
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

    get persistent () {
        return this.#persistent;
    }

    get version () {
        return this.#version;
    }

    get maxConnections () {
        return this.#maxConnections;
    }

    get pongInterval () {
        return this.#pongInterval;
    }

    get cache () {
        return this.#cache;
    }

    // public
    toString () {
        return this.url;
    }

    toJSON () {
        return this.url;
    }

    async cachedCall ( method, { key, maxAge }, ...args ) {
        var res;

        if ( key ) {
            key += "/" + method;

            res = this.cache.get( key );

            if ( res ) return res;
        }

        res = await this.call( method, ...args );

        this.cacheResult( res, key, maxAge );

        return res;
    }

    upload ( method, file, ...args ) {

        // add api version to nethod
        if ( method.charAt( 0 ) !== "/" ) {
            method = `/${this.version}/${method}`;
        }

        return new this.Upload( this, method, file, args );
    }

    cacheResult ( res, key, maxAge ) {

        // cache successful responses
        if ( key && res.ok && !res.meta["cache-control-no-cache"] ) {
            if ( res.meta["cache-control-expires"] ) {
                const _maxAge = Date.parse( res.meta["cache-control-expires"] ) - new Date();

                if ( !isNaN( _maxAge ) ) {
                    if ( maxAge && _maxAge < maxAge ) maxAge = _maxAge;
                    else maxAge = _maxAge;
                }
            }

            if ( res.meta["cache-control-max-age"] ) {
                const _maxAge = res.meta["cache-control-max-age"];

                if ( typeof _maxAge === "number" ) {
                    if ( maxAge && _maxAge < maxAge ) maxAge = _maxAge;
                    else maxAge = _maxAge;
                }
            }

            this.cache.set( key, res, maxAge );
        }
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
        if ( this.#cache.maxSize !== DEFAULT_CACHE_MAX_SIZE ) url.searchParams.set( "cacheMaxSize", +this.#cache.maxSize );
        if ( this.#cache.maxAge !== DEFAULT_CACHE_MAX_AGE ) url.searchParams.set( "cacheMaxAge", +this.#cache.maxAge );

        for ( const name of this.#clearCacheOn ) url.searchParams.append( "clearCacheOn", name );

        url.searchParams.sort();

        return url;
    }
}
