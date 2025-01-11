import { readConfig } from "#lib/config";
import externalResources from "#lib/external-resources";
import Cookies from "#lib/http/cookies";
import Headers from "#lib/http/headers";
import ProxyClient from "#lib/net/proxy";
import { Agent, buildConnector, Client, Pool } from "#lib/undici";

const resource = await externalResources
    .add( "softvisio-node/core/resources/http" )

    // .on( "update", resource => loadResources() )
    .check();

var BROWSERS;

loadResources();

function loadResources () {
    BROWSERS = readConfig( resource.getResourcePath( "browsers.json" ) );
}

const defaultConpress = true,
    defaultBrowser = "chrome-win32";

export default class Dispatcher extends Agent {
    #checkCertificate;
    #browser;
    #compress;
    #cookies;
    #proxy;
    #connectOptions;
    #connector;

    // pool options: https://github.com/nodejs/undici/blob/main/docs/docs/api/Pool.md#parameter-pooloptions
    // client options: https://github.com/nodejs/undici/blob/main/docs/docs/api/Client.md#parameter-clientoptions
    // connect options: https://github.com/nodejs/undici/blob/main/docs/docs/api/Client.md#parameter-connectoptions
    constructor ( { checkCertificate, compress, browser, cookies, proxy, ...options } = {} ) {
        options = {
            "connections": null, // pool creates unlimited number of connections
            "pipelining": 1, // use 0 to disable keep-alive
            "allowH2": true,
            "keepAliveTimeout": 4000, // default: 4s
            ...options,
        };

        super( {
            ...options,
            "factory": ( origin, options ) => this.#factory( origin, options ),
            "connect": async ( options, callback ) => this.#connect( options, callback ),
        } );

        this.checkCertificate = checkCertificate ?? true;
        this.browser = browser;
        this.compress = compress ?? defaultConpress;
        this.cookies = cookies;
        this.proxy = proxy;

        this.#connectOptions = {
            ...options.tls,
            ...options.connect,
            "allowH2": options.allowH2,
            "autoSelectFamily": options.autoSelectFamily,
            "autoSelectFamilyAttemptTimeout": options.autoSelectFamilyAttemptTimeout,
        };

        // default connect options
        this.#connectOptions.timeout ??= 10_000;
        this.#connectOptions.keepAlive ??= true;
        this.#connectOptions.keepAliveInitialDelay ??= 60_000;
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
        return this.#browser === true
            ? defaultBrowser
            : this.#browser;
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
    dispatch ( { compress, browser, cookies, hosts, ...options }, handlers ) {

        // prepare url
        const url = new URL( options.origin + options.path );

        // prepare headers
        if ( !( options.headers instanceof Headers ) ) {
            options.headers = new Headers( options.headers );
        }

        // compress
        if ( !( compress ?? this.compress ) ) {
            options.headers.delete( "accept-encoding" );
        }

        // browser
        browser ??= this.bfowser;

        if ( browser ) {
            browser = BROWSERS[ browser ];

            if ( !browser ) throw new Error( `Browser option is invalid` );

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
        cookies ??= this.cookies;

        if ( cookies ) {
            const cookie = cookies.get( url );

            if ( cookie ) options.headers.set( "cookie", cookie );

            const onHeaders = handlers.onHeaders;

            handlers.onHeaders = ( status, headers, resume, statusText ) => {
                const values = [];

                for ( let n = 0; n < headers.length; n += 2 ) {
                    if ( headers[ n ].toString( "latin1" ).toLowerCase() !== "set-cookie" ) continue;

                    values.push( headers[ n + 1 ].toString() );
                }

                if ( values.length ) {
                    cookies.add( url, Headers.parseSetCookie( values ) );
                }

                onHeaders.call( handlers, status, headers, resume, statusText );
            };
        }

        // hosts
        if ( hosts ) {
            const host = hosts[ url.hostname ];

            if ( host ) {
                options.headers.set( "host", host );
            }
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

    async #connect ( options, callback ) {
        var socket;

        // proxy
        if ( this.#proxy ) {
            try {
                socket = await this.#proxy.connect( {
                    ...options,
                    "checkCertificate": this.checkCertificate,
                    "connectTimeout": this.#connectOptions.timeout,
                } );

                if ( options.protocol === "http:" ) {
                    if ( this.#connectOptions.keepAlive ) {
                        socket.setKeepAlive( true, this.#connectOptions.keepAliveInitialDelay );
                    }

                    socket.setNoDelay( true );

                    callback?.( null, socket );

                    return socket;
                }
            }
            catch ( e ) {
                callback?.( e );

                return;
            }
        }

        this.#connector ??= buildConnector( this.#connectOptions );

        return this.#connector(
            {
                ...options,
                "httpSocket": socket,
                "rejectUnauthorized": this.#checkCertificate,
            },
            callback
        );
    }
}
