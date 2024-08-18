import "#lib/result";
import { fetch as udinciFetch, Agent as UdinciAgent, Client, Pool, buildConnector } from "#lib/undici";
import Headers from "#lib/http/headers";
import ProxyClient from "#lib/proxy";
import Cookies from "#lib/http/cookies";
import externalResources from "#lib/external-resources";
import { readConfig } from "#lib/config";
import DataUrl from "#lib/data-url";
import Response from "#lib/response";
import File from "#lib/file";
import StreamMultipart from "#lib/stream/multipart";
import { Stream } from "#lib/stream";

const defaultBrowser = "edge-windows";

const resource = await externalResources
    .add( "softvisio-node/core/resources/http" )
    .on( "update", resource => loadResources() )
    .check();

var RESOURCES;

loadResources();

function loadResources () {
    RESOURCES = readConfig( resource.location + "/http.json" );
}

export class Agent extends UdinciAgent {
    #checkCertificate;
    #browser;
    #compress;
    #cookies;
    #proxy;

    // XXX store cookies
    // if ( options.cookies && res.headers[ "set-cookie" ] ) {
    //     options.cookies.add( Headers.parseSetCookie( res.headers[ "set-cookie" ] ), url );
    // }

    // XXX
    constructor ( options = {} ) {
        options = {
            "connections": null,
            "pipelining": 1,
            "allowH2": true,

            "checkCertificate": true,
            "compress": true,

            ...options,
        };

        super( {

            // XXX servername
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

                        // XXX
                        // "servername": options.hostname,
                    },
                    callback
                );
            },

            // XXX servername, if hostname is not IP address
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

        this.checkCertificate = !!options.checkCertificate;
        this.browser = options.browser;
        this.compress = !!options.compress;
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
        const headers = new Headers( options.headers );

        // compress
        if ( !this.#compress ) {
            headers.delete( "accept-encoding" );
        }

        // add cookies
        if ( this.#cookies ) {
            const cookie = this.#cookies.get( options );

            if ( cookie ) headers.set( "cookie", cookie );
        }

        // add default headers
        if ( this.#browser ) {
            let browser;

            if ( this.#browser === true ) {
                browser = RESOURCES[ defaultBrowser ];
            }
            else {
                browser = RESOURCES[ options.browser ];
            }

            if ( !browser ) throw Error( `Browser option is invalid` );

            const defaultHeaders = browser[ options.protocol ];

            if ( defaultHeaders ) {
                for ( const [ header, value ] of Object.entries( defaultHeaders ) ) {
                    if ( !headers.has( header ) ) headers.set( header, value );
                }
            }

            // user-agent
            headers.set( "user-agent", browser.userAgent );
        }

        options.headers = headers.toJSON();

        return super.dispatch( options, handlers );
    }
}

export const agent = new Agent();

// XXX convert result
export default async function fetch ( url, options = {} ) {
    if ( typeof url === "string" ) url = new URL( url );

    const dispatcher = options.dispatcher || agent;

    // data url
    if ( url.protocol === "data:" ) {
        const dataUrl = DataUrl.new( url );

        return new Response( 200, url, {
            "headers": {
                "content-type": dataUrl.type,
                "content-length": dataUrl.data.length || 0,
            },
            "cookies": dispatcher.cookies,
            "body": dataUrl.data,
        } );
    }

    // clone options
    options = { ...options };

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

    options.headers = options.headers.toJSON();

    options.dispatcher = dispatcher;

    // XXX remove ???
    // options.dispatcher = {
    //     dispatch ( config, handlers ) {
    //         return agent.dispatch( config, handlers );
    //     },
    // };

    try {
        const res = await udinciFetch( url, options );

        return new Response( res, null, {
            "cookies": dispatcher.cookies,
        } );
    }
    catch ( e ) {
        return result.catch( e );
    }
}

Object.defineProperty( fetch, "Agent", {
    "value": Agent,
    "configurable": false,
    "writable": false,
} );
