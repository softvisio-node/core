import WebSocket from "./websocket.js";
import CacheLru from "#lib/cache/lru";

const DEFAULT_VERSION = "v1";
const DEFAULT_PONG_INTERVAL = 0;
const DEFAULT_MAX_CONNECTIONS = 1;
const DEFAULT_CACHE_MAX_SIZE = 10_000;
const DEFAULT_CACHE_MAX_AGE = 0;

export default class extends WebSocket {
    #protocol;
    #hostname;
    #port;
    #pathname = "/";
    #isPersistent;
    #token;
    #version;
    #maxConnections;
    #pongInterval;
    #onRpc;
    #onAuthorization;

    #url;
    #httpUrl;
    #websocketsUrl;
    #uploadUrl;
    #cache;
    #clearCacheOn = new Set();

    constructor ( url, { token, persistent, version, maxConnections, pongInterval, onRpc, onAuthorization, cache, cacheMaxSize, cacheMaxAge, clearCacheOn } = {} ) {
        super();

        url = this._resolveUrl( url );

        this.#protocol = url.protocol;
        this.#hostname = url.hostname;
        this.#port = url.port;
        this.#pathname = url.pathname;

        // token
        this.#token = ( token ?? decodeURIComponent( url.username ) ) || null;

        // persistent
        this.#isPersistent = persistent ?? url.searchParams.get( "persistent" );
        if ( this.#isPersistent == null || this.#isPersistent === "" ) {
            this.#isPersistent = this.#protocol.startsWith( "ws" );
        }
        else {
            this.#isPersistent = this.#isPersistent === true || this.#isPersistent === "true";
        }

        // set protocol according to the persistent value
        if ( this.#isPersistent ) {
            if ( this.#protocol === "http:" ) this.#protocol = "ws:";
            else if ( this.#protocol === "https:" ) this.#protocol = "wss:";
        }
        else {
            if ( this.#protocol === "ws:" ) this.#protocol = "http:";
            else if ( this.#protocol === "wss:" ) this.#protocol = "https:";
        }

        // version
        this.#version = ( version ?? url.searchParams.get( "version" ) ) || DEFAULT_VERSION;

        // maxConnections
        this.#maxConnections = +( maxConnections || url.searchParams.get( "maxConnections" ) || DEFAULT_MAX_CONNECTIONS );
        if ( !Number.isInteger( this.#maxConnections ) || this.#maxConnections < 1 ) {
            throw TypeError( `API client maxConnections value is invalid` );
        }

        // pongInterval
        this.#pongInterval = +( pongInterval ?? ( url.searchParams.get( "pongInterval" ) || DEFAULT_PONG_INTERVAL ) );
        if ( !Number.isInteger( this.#pongInterval ) || this.#pongInterval < 0 ) {
            throw TypeError( `API client pongInterval value is invalid` );
        }

        // onRpc
        this.#onRpc = onRpc;

        // onAuthorization
        this.#onAuthorization = onAuthorization;

        // cache
        cacheMaxSize = +( cacheMaxSize ?? ( url.searchParams.get( "cacheMaxSize" ) || DEFAULT_CACHE_MAX_SIZE ) );
        if ( !Number.isInteger( cacheMaxSize ) || cacheMaxSize <= 0 ) {
            throw TypeError( `API client pongInterval value is invalid` );
        }

        // XXX
        cacheMaxAge = parseInt( cacheMaxAge ?? url.searchParams.get( "cacheMaxAge" ) );
        if ( isNaN( cacheMaxAge ) ) cacheMaxAge = DEFAULT_CACHE_MAX_AGE;

        this.#cache =
            cache ||
            new CacheLru( {
                "maxSize": cacheMaxSize,
                "maxAge": cacheMaxAge,
            } );

        // cache drop events
        new Set( clearCacheOn ?? url.searchParams.getAll( "clearCacheOn" ) ).forEach( name => {
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
        if ( api.isPersistent ) api._connectWebSocket();

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
            if ( this.#isPersistent ) this.#url = this.websocketsUrl;
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

    get isPersistent () {
        return this.#isPersistent;
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

    get onRpc () {
        return this.#onRpc;
    }

    get onAuthorization () {
        return this.#onAuthorization;
    }

    // public
    toString () {
        return this.url;
    }

    toJSON () {
        return this.url;
    }

    upload ( method, formData ) {
        return new this.Upload( this, method, formData );
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

        if ( this.#clearCacheOn.size ) {
            url.searchParams.append( "clearCacheOn", [...this.#clearCacheOn].join( "," ) );
        }

        url.searchParams.sort();

        return url;
    }
}
