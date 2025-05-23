import "#lib/result";
import DataUrl from "#lib/data-url";
import File from "#lib/file";
import FileStream from "#lib/file-stream";
import Cookies from "#lib/http/cookies";
import Dispatcher from "#lib/http/dispatcher";
import Headers from "#lib/http/headers";
import Response from "#lib/http/response";
import { Stream } from "#lib/stream";
import StreamMultipart from "#lib/stream/multipart";
import { fetch as udinciFetch } from "#lib/undici";

const defaultUserAgent = "node";

export const globalDispatcher = new Dispatcher();

export default async function fetch ( url, { compress, browser, cookies, headersTimeout, bodyTimeout, reset, blocking, ...options } = {} ) {
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

    // prepare headers
    if ( options.headers instanceof Headers ) {
        options.headers = new Headers( options.headers.toJSON() );
    }
    else {
        options.headers = new Headers( options.headers );
    }

    if ( !options.headers.has( "user-agent" ) ) {
        options.headers.set( "user-agent", defaultUserAgent );
    }

    // compress
    compress ??= dispatcher.compress ?? Dispatcher.defaultConpress;

    // browser
    browser ??= dispatcher.browser;

    if ( browser === true ) {
        browser = Dispatcher.defaultBrowser;
    }

    // referrer
    if ( browser ) {
        options.referrer ??= true;
    }

    if ( options.referrer === true || options.referrer === "about:client" ) {
        options.referrer = url;
    }

    // cookies
    cookies ??= dispatcher.cookies;

    if ( cookies === true ) {
        cookies = new Cookies();
    }

    // host
    if ( options.headers.get( "host" ) ) {
        var hosts = {
            [ url.hostname ]: options.headers.get( "host" ),
        };
    }

    // prepare body
    if ( options.body != null ) {
        options.duplex = "half";

        const body = options.body;

        let contentLength, contentType;

        // buffer
        if ( Buffer.isBuffer( body ) ) {
            contentLength = body.length;
        }

        // file
        else if ( body instanceof File ) {
            options.body = await body.stream();

            contentLength = await body.getSize();
            contentType = body.type;
        }

        // blob
        else if ( body instanceof Blob ) {
            options.body = body.stream();

            contentLength = body.size;
            contentType = body.type;
        }

        // file stream
        else if ( body instanceof FileStream ) {
            contentLength = body.size;
            contentType = body.type;
        }

        // url search params
        else if ( body instanceof URLSearchParams ) {
            options.body = Buffer.from( body.toString() );

            contentLength = options.body.length;
            contentType = "application/x-www-form-urlencoded; charset=UTF-8";
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
            contentType = "text/plain; charset=UTF-8";
        }

        if ( contentLength != null ) options.headers.set( "content-length", String( contentLength ) );

        if ( contentType != null && !options.headers.has( "content-type" ) ) options.headers.set( "content-type", contentType );
    }

    // set headers
    options.headers = options.headers.toJSON();

    var responseStatus;

    // set dispatcher
    options.dispatcher = {
        dispatch ( options, handlers ) {
            responseStatus = null;

            const onHeaders = handlers.onHeaders;

            handlers.onHeaders = ( status, headers, resume, statusText ) => {
                responseStatus = [ status, statusText ];

                onHeaders.call( handlers, status, headers, resume, statusText );
            };

            options.headersTimeout = headersTimeout;
            options.bodyTimeout = bodyTimeout;
            options.reset = reset;
            options.blocking = blocking;

            options.compress = compress;
            options.browser = browser;
            options.cookies = cookies;
            options.hosts = hosts;

            dispatcher.dispatch( options, handlers );
        },
    };

    var res;

    try {
        res = await udinciFetch( url, options );
    }
    catch ( e ) {

        // preserve 407 status
        if ( responseStatus?.[ 0 ] === 407 ) {
            res = result( responseStatus );
        }
        else {
            res = result.catch( e.cause, { "log": false } );
        }
    }

    res.cookies = cookies;

    return new Response( res );
}

Object.defineProperties( fetch, {
    "Dispatcher": {
        "value": Dispatcher,
        "configurable": false,
        "writable": false,
    },
    "Headers": {
        "value": Headers,
        "configurable": false,
        "writable": false,
    },
} );
