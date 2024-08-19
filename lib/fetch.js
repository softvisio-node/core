import "#lib/result";
import { fetch as udinciFetch, Agent, Client, Pool, buildConnector } from "#lib/undici";
import Headers from "#lib/http/headers";
import ProxyClient from "#lib/proxy";
import Cookies from "#lib/http/cookies";
import externalResources from "#lib/external-resources";
import { readConfig } from "#lib/config";
import DataUrl from "#lib/data-url";
import Response from "#lib/http/response";
import File from "#lib/file";
import StreamMultipart from "#lib/stream/multipart";
import { Stream } from "#lib/stream";

const defaultConpress = true,
    defaultBrowser = "edge-windows";

const resource = await externalResources
    .add( "softvisio-node/core/resources/http" )
    .on( "update", resource => loadResources() )
    .check();

var RESOURCES;

loadResources();

function loadResources () {
    RESOURCES = readConfig( resource.location + "/http.json" );
}

export class Dispatcher extends Agent {
    #checkCertificate;
    #browser;
    #compress;
    #cookies;
    #proxy;

    // XXX store cookies
    // if ( options.cookies && res.headers[ "set-cookie" ] ) {
    //     options.cookies.add( Headers.parseSetCookie( res.headers[ "set-cookie" ] ), url );
    // }

    constructor ( options = {} ) {
        options = {
            "connections": null,
            "pipelining": 1, // use 0 to disable keep-alive
            "allowH2": true,
            "keepAliveTimeout": null, // default: 463

            "checkCertificate": true,
            "compress": defaultConpress,

            ...options,
        };

        super( {
            "connect": async ( options, callback ) => {
                var httpSocket;

                // proxy
                if ( this.#proxy ) {
                    try {
                        httpSocket = await this.#proxy.connect( options );

                        if ( options.protocol === "http:" ) {
                            if ( options.keepAlive == null || options.keepAlive ) {
                                const keepAliveInitialDelay = options.keepAliveInitialDelay === undefined ? 60e3 : options.keepAliveInitialDelay;
                                httpSocket.setKeepAlive( true, keepAliveInitialDelay );
                            }

                            httpSocket.setNoDelay( true );

                            callback?.( null, httpSocket );

                            return httpSocket;
                        }
                    }
                    catch ( e ) {
                        callback?.( e );

                        return;
                    }
                }

                // allowH2, maxCachedSessions, socketPath, timeout, "session": customSession, ...opts
                const connector = buildConnector( {
                    ...options,
                } );

                // hostname, host, protocol, port, servername, localAddress, httpSocket
                return connector(
                    {
                        ...options,
                        "httpSocket": options.protocol === "https:" ? httpSocket : null,
                        "rejectUnauthorized": this.#checkCertificate,
                    },
                    callback
                );
            },

            "factory": ( origin, options ) => {
                if ( options?.connections === 1 ) {
                    return new Client( origin, options );
                }
                else {
                    return new Pool( origin, options );
                }
            },

            ...options,
        } );

        this.checkCertificate = options.checkCertificate;
        this.browser = options.browser;
        this.compress = options.compress ?? defaultConpress;
        this.cookies = options.cookies;
        this.proxy = options.proxy;
    }

    // properties
    get checkCertificate () {
        return this.#checkCertificate;
    }

    set checkCertificate ( value ) {
        this.#checkCertificate = !!value;
    }

    get browser () {
        return this.#browser === true ? defaultBrowser : this.#browser;
    }

    set browser ( value ) {
        this.#browser = value;
    }

    get compress () {
        return this.#compress;
    }

    set compress ( value ) {
        this.#compress = !!value;
    }

    get cookies () {
        return this.#cookies;
    }

    set cookies ( value ) {
        if ( !value ) {
            this.#cookies = null;
        }
        else if ( value === true ) {
            this.#cookies = new Cookies();
        }
        else {
            this.#cookies = value;
        }
    }

    get proxy () {
        return this.#proxy;
    }

    set proxy ( value ) {
        if ( !value ) {
            this.#proxy = null;
        }
        else {
            this.#proxy = ProxyClient.new( value );
        }
    }

    // public
    dispatch ( options, handlers ) {
        if ( !options._headersProcessed ) {
            const headers = new Headers( options.headers );

            setHeaders( options, headers, this );

            this._processHeaders( headers );

            options.headers = headers.toJSON();
        }

        return super.dispatch( options, handlers );
    }

    // protected
    _processHeaders ( headers ) {}
}

export const globalDispatcher = new Dispatcher();

// XXX referer ???
export default async function fetch ( url, options = {} ) {
    if ( typeof url === "string" ) url = new URL( url );

    // prepare dispatcher
    const dispatcher = options.dispatcher || globalDispatcher;

    // data url
    if ( url.protocol === "data:" ) {
        const dataUrl = DataUrl.new( url );

        return new Response( {
            "status": 200,
            url,
            "headers": {
                "content-type": dataUrl.type,
                "content-length": dataUrl.data.length || 0,
            },
            "body": dataUrl.data,
            "cookies": dispatcher.cookies,
        } );
    }

    // clone options
    options = { ...options };

    // prepare options
    options.compress ??= dispatcher.compress ?? defaultConpress;

    options.browser ??= dispatcher.browser;

    if ( options.browser === true ) {
        options.browser = defaultBrowser;
    }

    options.cookies ??= dispatcher.cookies;

    if ( options.cookies === true ) {
        options.cookies = new Cookies();
    }

    // prepare headers
    if ( options.headers instanceof Headers ) {
        options.headers = new Headers( options.headers.toJSON() );
    }
    else {
        options.headers = new Headers( options.headers );
    }

    // prepare body
    if ( options.body != null ) {
        const body = options.body;

        let contentLength, contentType;

        // buffer
        if ( Buffer.isBuffer( body ) ) {
            contentLength = body.length;
        }

        // file
        else if ( body instanceof File ) {
            options.body = await body.stream();

            contentLength = body.size;
            contentType = body.type;
        }

        // blob
        else if ( body instanceof Blob ) {
            options.body = body.stream();

            contentLength = body.size;
            contentType = body.type;
        }

        // url search params
        else if ( body instanceof URLSearchParams ) {
            options.body = Buffer.from( body.toString() );

            contentLength = options.body.length;
            contentType = "application/x-www-form-urlencoded;charset=UTF-8";
        }

        // form data
        else if ( body instanceof StreamMultipart ) {
            contentLength = body.length;
            contentType = body.type;
        }

        // stream
        else if ( body instanceof Stream ) {
            contentLength = null;
        }

        // string
        else {
            options.body = Buffer.from( String( body ) );

            contentLength = options.body.length;
            contentType = "text/plain;charset=UTF-8";
        }

        if ( contentLength != null ) options.headers.set( "content-length", String( contentLength ) );

        if ( contentType != null && !options.headers.has( "content-type" ) ) options.headers.set( "content-type", contentType );
    }

    const hosts = {
        [ url.hostname ]: options.headers.get( "host" ),
    };

    // set headers
    options.headers = options.headers.toJSON();

    // set dispatcher
    options.dispatcher = {
        dispatch ( req, handlers ) {
            const headers = new Headers( req.headers );

            setHeaders( req, headers, options );

            // set host header
            const host = hosts[ new URL( req.origin ).hostname ];
            if ( host ) {
                headers.set( "host", host );
            }

            req.headers = headers.toJSON();

            req._headersProcessed = true;

            dispatcher.dispatch( req, handlers );
        },
    };

    try {
        const res = await udinciFetch( url, options );

        res.cookies = options.cookies;

        return new Response( res );
    }
    catch ( e ) {
        return new Response( result.catch( e, { "log": false } ) );
    }
}

function setHeaders ( url, headers, { compress, cookies, browser } = {} ) {

    // compress
    if ( !compress ) {
        headers.delete( "accept-encoding" );
    }

    // add cookies
    if ( cookies ) {
        const cookie = cookies.get( url );

        if ( cookie ) headers.set( "cookie", cookie );
    }

    // add default headers
    if ( browser ) {
        if ( browser === true ) {
            browser = RESOURCES[ defaultBrowser ];
        }
        else {
            browser = RESOURCES[ browser ];
        }

        if ( !browser ) throw Error( `Browser option is invalid` );

        const defaultHeaders = browser[ url.protocol ];

        if ( defaultHeaders ) {
            for ( const [ header, value ] of Object.entries( defaultHeaders ) ) {
                if ( !headers.has( header ) ) headers.set( header, value );
            }
        }

        // user-agent
        headers.set( "user-agent", browser.userAgent );
    }
}

Object.defineProperty( fetch, "Dispatcher", {
    "value": Dispatcher,
    "configurable": false,
    "writable": false,
} );
