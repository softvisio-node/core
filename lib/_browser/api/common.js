import WebSocket from "./websocket.js";
import CacheLru from "#lib/cache/lru";
import Interval from "#lib/interval";
import isBrowser from "#lib/is-browser";

const DEFAULT_VERSION = 1;
const DEFAULT_CACHE_MAX_SIZE = 10_000;
const DEFAULT_CACHE_MAX_AGE = 0;

export default class extends WebSocket {
    #protocol;
    #hostname;
    #port;
    #pathname = "/";
    #isPersistent;
    #token;
    #locale;
    #version;
    #maxConnections;
    #checkCertificate;
    #onRpc;
    #onAuthorization;

    #url;
    #httpUrl;
    #websocketsUrl;
    #uploadUrl;
    #realMaxConnections;
    #cache;
    #clearCacheOn = new Set();

    constructor ( url, { token, locale, persistent, version, maxConnections, checkCertificate, onRpc, onAuthorization, cache, cacheMaxSize, cacheMaxAge, clearCacheOn } = {} ) {
        super();

        url = this._resolveUrl( url );

        this.#protocol = url.protocol;
        this.#hostname = url.hostname;
        this.#port = url.port;
        this.#pathname = url.pathname;

        // token
        this.#token = ( token ?? decodeURIComponent( url.username ) ) || null;

        // locale
        if ( locale ) {
            this.#locale = locale;
        }
        else {
            this.#locale = url.searchParams.get( "locale" ) || null;
        }

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
        this.#version = +( version ?? url.searchParams.get( "version" ) ) || DEFAULT_VERSION;
        if ( !Number.isInteger( this.#version ) || this.#version < 1 ) {
            throw TypeError( `API client version value is invalid` );
        }

        // maxConnections
        this.#maxConnections = maxConnections || url.searchParams.get( "maxConnections" );
        if ( !this.#maxConnections ) {
            this.#maxConnections = null;
        }
        else {
            this.#maxConnections = +this.#maxConnections;

            if ( !Number.isInteger( this.#maxConnections ) || this.#maxConnections < 1 ) {
                throw TypeError( `API client maxConnections value is invalid` );
            }
        }

        // tls check certificate
        if ( checkCertificate === false ) {
            this.#checkCertificate = false;
        }
        else {
            this.#checkCertificate = true;
        }

        // onRpc
        this.#onRpc = onRpc;

        // onAuthorization
        this.#onAuthorization = onAuthorization;

        // cache
        cacheMaxSize = +( cacheMaxSize ?? ( url.searchParams.get( "cacheMaxSize" ) || DEFAULT_CACHE_MAX_SIZE ) );
        if ( !Number.isInteger( cacheMaxSize ) || cacheMaxSize <= 0 ) {
            throw TypeError( `API client cacheMaxSize value is invalid` );
        }

        cacheMaxAge = url.searchParams.get( "cacheMaxAge" ) || DEFAULT_CACHE_MAX_AGE;

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
            if ( this.#isPersistent ) {
                this.#url = this.websocketsUrl;
            }
            else {
                this.#url = this.httpUrl;
            }
        }

        return this.#url;
    }

    get httpUrl () {
        if ( !this.#httpUrl ) {
            const url = this.#buildUrl();

            if ( url.protocol === "ws:" ) {
                url.protocol = "http:";
            }
            else if ( url.protocol === "wss:" ) {
                url.protocol = "https:";
            }

            this.#httpUrl = url.href;
        }

        return this.#httpUrl;
    }

    get websocketsUrl () {
        if ( !this.#websocketsUrl ) {
            const url = this.#buildUrl();

            if ( url.protocol === "http:" ) {
                url.protocol = "ws:";
            }
            else if ( url.protocol === "https:" ) {
                url.protocol = "wss:";
            }

            if ( this.#maxConnections ) {
                url.searchParams.set( "maxConnections", this.#maxConnections );
            }

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

    get locale () {
        return this.#locale;
    }

    set locale ( value ) {
        value ||= null;

        // not changed
        if ( this.#locale === value ) return;

        this.#locale = value;

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

    get realMaxConnections () {
        if ( this.#realMaxConnections == null ) {

            // max connections always 1 under the browser
            if ( isBrowser ) {
                this.#realMaxConnections = 1;
            }

            // wss: protocol always use 1 connection
            else if ( this.websocketsUrl.startsWith( "wss:" ) ) {
                this.#realMaxConnections = 1;
            }
            else {
                this.#realMaxConnections = this.maxConnections || Infinity;
            }
        }

        return this.#realMaxConnections;
    }

    get checkCertificate () {
        return this.#checkCertificate;
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

    async cachedCall ( method, ...args ) {
        var key, maxAge, signal;

        if ( typeof method === "object" ) {
            ( { method, "arguments": args, key, maxAge, signal } = method );
        }

        key = method + "/" + ( key ?? "" );

        var res = this.cache.get( key );

        if ( res ) return res;

        res = await this.call( {
            method,
            "arguments": args,
            signal,
        } );

        this.cacheResult( res, key, maxAge );

        return res;
    }

    cacheResult ( res, key, maxAge ) {

        // cache successful responses
        if ( key && res.ok && !res.meta[ "cache-control-no-cache" ] ) {
            if ( maxAge ) maxAge = Interval.new( maxAge ).toMilliseconds();

            if ( res.meta[ "cache-control-expires" ] ) {
                const remoteMaxAge = Date.parse( res.meta[ "cache-control-expires" ] ) - new Date();

                if ( !isNaN( remoteMaxAge ) ) {
                    if ( !maxAge ) {
                        maxAge = remoteMaxAge;
                    }
                    else if ( remoteMaxAge < maxAge ) {
                        maxAge = remoteMaxAge;
                    }
                }
            }

            if ( res.meta[ "cache-control-max-age" ] ) {
                const remoteMaxAge = new Interval( res.meta[ "cache-control-max-age" ] ).toMilliseconds();

                if ( !maxAge ) {
                    maxAge = remoteMaxAge;
                }
                else if ( remoteMaxAge < maxAge ) {
                    maxAge = remoteMaxAge;
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

        if ( this.#locale ) url.searchParams.set( "locale", this.#locale );

        if ( this.#version !== DEFAULT_VERSION ) url.searchParams.set( "version", this.#version );

        if ( this.#cache.maxSize !== DEFAULT_CACHE_MAX_SIZE ) url.searchParams.set( "cacheMaxSize", +this.#cache.maxSize );

        if ( this.#cache.maxAge !== DEFAULT_CACHE_MAX_AGE ) url.searchParams.set( "cacheMaxAge", new Interval( this.#cache.maxAge ) + "" );

        if ( this.#clearCacheOn.size ) {
            url.searchParams.append( "clearCacheOn", [ ...this.#clearCacheOn ].join( "," ) );
        }

        url.searchParams.sort();

        return url;
    }
}
