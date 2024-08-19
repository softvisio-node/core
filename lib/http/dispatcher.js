import { Agent, Client, Pool, buildConnector } from "#lib/undici";
import Headers from "#lib/http/headers";
import ProxyClient from "#lib/proxy";
import Cookies from "#lib/http/cookies";
import externalResources from "#lib/external-resources";
import { readConfig } from "#lib/config";

const resource = await externalResources
    .add( "softvisio-node/core/resources/http" )
    .on( "update", resource => loadResources() )
    .check();

var RESOURCES;

loadResources();

function loadResources () {
    RESOURCES = readConfig( resource.location + "/http.json" );
}

const defaultConpress = true,
    defaultBrowser = "edge-windows";

export default class Dispatcher extends Agent {
    #checkCertificate;
    #browser;
    #compress;
    #cookies;
    #proxy;
    #socketPath;

    // XXX socketPath
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
            "factory": ( origin, options ) => this.#factory( origin, options ),
            "connect": async ( options, callback ) => this.#connect( options, callback ),
            ...options,
        } );

        this.checkCertificate = options.checkCertificate;
        this.browser = options.browser;
        this.compress = options.compress ?? defaultConpress;
        this.cookies = options.cookies;
        this.proxy = options.proxy;

        // XXX https://github.com/nodejs/undici/issues/3486
        this.#socketPath = options.socketPath;
    }

    // static
    static get defaultConpress () {
        return defaultConpress;
    }

    static get defaultBrowser () {
        return defaultBrowser;
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
        if ( !value ) {
            this.#browser = null;
        }
        else if ( value === true ) {
            this.#browser = defaultBrowser;
        }
        else {
            this.#browser = value;
        }
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

        // prepare url
        const url = new URL( options.origin + options.path );

        // prepare headers
        if ( !( options.headers instanceof Headers ) ) {
            options.headers = new Headers( options.headers );
        }

        // compress
        if ( !( options._compress ?? this.compress ) ) {
            options.headers.delete( "accept-encoding" );
        }

        // browser
        var browser = options._browser ?? this.bfowser;

        if ( browser ) {
            browser = RESOURCES[ browser ];

            if ( !browser ) throw Error( `Browser option is invalid` );

            const defaultHeaders = browser[ url.protocol ];

            if ( defaultHeaders ) {
                for ( const [ header, value ] of Object.entries( defaultHeaders ) ) {
                    if ( !options.headers.has( header ) ) options.headers.set( header, value );
                }
            }

            // user-agent
            options.headers.set( "user-agent", browser.userAgent );
        }

        // cookies
        const cookies = options._cookies ?? this.cookies;

        if ( cookies ) {
            const cookie = cookies.get( url );

            if ( cookie ) options.headers.set( "cookie", cookie );

            const onHeaders = handlers.onHeaders;

            handlers.onHeaders = ( status, headers, resume, statusText ) => {
                for ( let n = 0; n < headers.length; n += 2 ) {
                    if ( headers[ n ].toString( "latin1" ).toLowerCase() !== "set-cookie" ) continue;

                    cookies.add( Headers.parseSetCookie( headers[ n + 1 ].toString() ), url );
                }

                if ( onHeaders ) {
                    onHeaders( status, headers, resume, statusText );
                }
            };
        }

        // process headers
        this._processHeaders( options.headers );

        // serialize headers
        options.headers = options.headers.toJSON();

        return super.dispatch( options, handlers );
    }

    // protected
    _processHeaders ( headers ) {}

    // private
    #factory ( origin, options ) {
        if ( options?.connections === 1 ) {
            return new Client( origin, options );
        }
        else {
            return new Pool( origin, options );
        }
    }

    // XXX socketPath
    async #connect ( options, callback ) {

        // XXX remove
        options = {
            ...options,
            "socketPath": this.#socketPath,
        };

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
    }
}
