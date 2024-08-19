import "#lib/result";
import { fetch as udinciFetch } from "#lib/undici";
import Headers from "#lib/http/headers";
import Cookies from "#lib/http/cookies";
import DataUrl from "#lib/data-url";
import Response from "#lib/http/response";
import File from "#lib/file";
import StreamMultipart from "#lib/stream/multipart";
import { Stream } from "#lib/stream";
import Dispatcher from "#lib/http/dispatcher";

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
    options.compress ??= dispatcher.compress ?? Dispatcher.defaultConpress;

    options.browser ??= dispatcher.browser;

    if ( options.browser === true ) {
        options.browser = Dispatcher.defaultBrowser;
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

            Dispatcher.setHeaders( req, headers, options );

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

Object.defineProperty( fetch, "Dispatcher", {
    "value": Dispatcher,
    "configurable": false,
    "writable": false,
} );
