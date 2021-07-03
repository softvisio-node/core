import Options from "./options.js";
import LRUCache from "lru-cache";

const DEFAULT_MAX_CONNECTIONS = Infinity;
const DEFAULT_CACHE_SIZE = 1000;

export default class extends Options {
    #url;
    #token;
    #persistent = true;
    #json = false;
    #version = "v1";
    #pongInterval = 0; // = 1000 * 40; // 40 seconds for cloudflare
    #onRPC;
    #maxConnections = DEFAULT_MAX_CONNECTIONS;
    #cache;

    // static
    static new ( url, options = {} ) {
        const api = new this();

        api.init( url, options );

        return api;
    }

    // XXX
    init1 ( url, options = {} ) {
        url = this._resolveURL( url );

        this.#setURL( url );
        this.#setToken( options.token ?? url.username );

        if ( "persistent" in options ) this.#setPersistent( options.persistent );
        if ( "json" in options ) this.json = options.json;
        if ( "version" in options ) this.version = options.version;
        if ( "pongInterval" in options ) this.#setPongInterval( options.pongInterval );
        if ( "maxConnections" in options ) this.#setMaxConnections( options.maxConnections );

        url = this._resolveUrl( url );

        if ( url.searchParams.has( "json" ) ) this.json = url.searchParams.get( "json" );
        if ( url.searchParams.has( "version" ) ) this.version = url.searchParams.get( "version" );
        if ( url.searchParams.has( "pongInterval" ) ) this.#setPongInterval( url.searchParams.get( "pongInterval" ) );
        if ( url.searchParams.has( "maxConnections" ) ) this.#setMaxConnections( url.searchParams.get( "maxConnections" ) );

        // cache related url params
        // cacheDrop <string[]> events to drop cache
        // cacheMax
        // cacheMaxAge
        const cacheOptions = {};

        cacheOptions.max = options.cacheMax ?? ( url.searchParams.get( "cacheMax" ) ? +url.searchParams.get( "cacheMax" ) : null ) ?? DEFAULT_CACHE_SIZE;
        cacheOptions.maxAge = options.cacheMaxAge ?? ( url.searchParams.get( "cacheMaxAge" ) ? +url.searchParams.get( "cacheMaxAge" ) : null );

        this.#cache = new LRUCache( cacheOptions );

        const cacheDrop = options.cacheDrop ?? url.searchParams.getAll( "cacheDrop" );

        for ( const eventName of cacheDrop ) this.on( eventName, () => this.#cache.reset() );

        this.onRPC = options.onRPC;

        // start persistent connection
        if ( this.#persistent ) this._connectWebSocket();
    }

    // properties
    get api () {
        return this;
    }

    get cache () {
        return this.#cache;
    }

    // public
    async callCached ( key, method, ...args ) {
        var maxAge;

        if ( Array.isArray( key ) ) [key, maxAge] = key;

        var res;

        if ( key ) {
            key += "/" + method;

            res = this.#cache.get( key );

            if ( res ) return res;
        }

        res = await this.call( method, ...args );

        if ( key && res.ok ) this.#cache.set( key, res, maxAge );

        return res;
    }

    upload ( method, file, ...args ) {

        // add api version to nethod
        if ( method.charAt( 0 ) !== "/" ) {
            method = `/${this.version}/${method}`;
        }

        return new this.Upload( this, method, file, args );
    }

    // private
    #setURL ( url ) {
        url = this._resolveUrl( url );

        this.#url = new URL( url );
        this.#url.username = "";
        this.#url.password = "";
        this.#url.search = "";
        this.#url.hash = "";

        if ( url.searchParams.has( "persistent" ) ) {
            this.#setPersistent( url.searchParams.get( "persistent" ) );
        }
        else {
            if ( url.protocol.startsWith( "http" ) ) this.#setPersistent( false );
            else this.#setPersistent( true );
        }
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
