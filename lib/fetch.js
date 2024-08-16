import Response from "#lib/http/response";
import http from "node:http";
import https from "node:https";
import { objectIsPlain } from "#lib/utils";
import File from "#lib/file";
import StreamMultipart from "#lib/stream/multipart";
import { Stream } from "#lib/stream";
import { pipeline } from "node:stream/promises";
import Headers from "#lib/http/headers";
import { cookies as globalCookies } from "#lib/http/cookies";
import { readConfig } from "#lib/config";
import DataUrl from "#lib/data-url";
import Agent from "#lib/http/agent";
import externalResources from "#lib/external-resources";

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

const REDIRECT_STATUSES = new Set( [ 301, 302, 303, 307, 308 ] );

const DEFAULT_USER_AGENT = "core/fetch";

export default async function fetch ( url, options = {} ) {
    if ( typeof url === "string" ) url = new URL( url );

    options = { ...options };

    options.method ||= "GET";
    options.method = options.method.toUpperCase();
    options.redirect ||= "follow";
    options.follow ??= 20;
    options.redirected = false;
    options.compress ??= true;
    options.credentials ||= "same-origin";
    options.referrerPolicy ||= "strict-origin-when-cross-origin";
    options._origin = null;
    options._originSecure = null;
    options._agentBuilder = null;

    if ( options.checkCertificate === false ) {
        options.rejectUnauthorized = false;
    }
    else {
        options.rejectUnauthorized = true;
    }

    if ( options.headers instanceof Headers ) options.headers = options.headers.toJSON();

    // cookies
    if ( options.cookies === true ) options.cookies = globalCookies;

    // agent
    if ( options.agent ) {
        if ( objectIsPlain( options.agent ) ) {
            options.agent = new Agent( options.agent );
            options._agentBuilder = options.agent.fetchAgent;
        }
        else if ( options.agent instanceof Agent ) {
            options._agentBuilder = options.agent.fetchAgent;
        }
        else if ( typeof options.agent === "function" ) {
            options._agentBuilder = options.agent;
        }

        options.cookies ??= options.agent.cookies;
    }

    // body
    if ( options.body != null && ( options.method === "GET" || options.method === "HEAD" ) ) {
        return error( result( [ 400, `Request with GET/HEAD method cannot have body` ] ), url, options );
    }

    return request( url, options );
}

async function request ( url, options ) {

    // data url
    if ( url.protocol === "data:" ) {
        const dataUrl = DataUrl.new( url );

        return new Response( 200, url, {
            "headers": {
                "content-type": dataUrl.type,
                "content-length": dataUrl.data.length || 0,
            },
            "cookies": options.cookies,
            "body": dataUrl.data,
        } );
    }

    // invalid protocol
    else if ( url.protocol !== "http:" && url.protocol !== "https:" ) {
        return error( result( [ 400, `Invalid URL protocol` ] ), url, options );
    }

    if ( options._agentBuilder ) options.agent = options._agentBuilder( url );

    const req = ( url.protocol === "http:" ? http : https ).request( url, options );

    // origin
    if ( !options._origin ) {
        options.referrer = new URL( options.referrer || req.getHeader( "referer" ) || url );
        options.referrer.username = "";
        options.referrer.password = "";
        options.referrer.hash = "";
        options._origin = options.referrer.origin;
        options._originSecure = options.referrer.protocol === "https:";
        options.referrer = options.referrer.href;
    }

    // add default headers
    if ( options.browser ) {
        let browser;

        if ( options.browser === true ) {
            browser = RESOURCES[ defaultBrowser ];
        }
        else {
            browser = RESOURCES[ options.browser ];
        }

        if ( !browser ) return error( result( [ 400, `Browser option is invalid` ] ), url, options, req );

        const defaultHeaders = browser[ url.protocol ];

        if ( defaultHeaders ) {
            for ( const [ header, value ] of Object.entries( defaultHeaders ) ) {
                if ( !req.hasHeader( header ) ) req.setHeader( header, value );
            }
        }

        // user-agent
        if ( !req.hasHeader( "user-agent" ) ) req.setHeader( "User-Agent", browser.userAgent );
    }

    // default user-agent
    if ( !req.hasHeader( "user-agent" ) ) req.setHeader( "User-Agent", DEFAULT_USER_AGENT );

    // accept-encoding
    if ( options.compress ) req.setHeader( "Accept-Encoding", "gzip,deflate,br" );

    // sync the "connection" header with the agent.keepAlive option
    req.setHeader( "Connection", req.agent.keepAlive ? "keep-alive" : "close" );

    // cookie
    if ( options.cookies ) {
        const cookie = options.cookies.get( url );

        if ( cookie ) req.setHeader( "Cookie", cookie );
    }

    const sameOrigin = options._origin === url.origin,
        downgrade = options._originSecure && url.protocol !== "http:";

    // credentials
    CREDENTIALS: {
        if ( options.credentials === "same-origin" ) {
            if ( sameOrigin ) break CREDENTIALS;
        }
        else if ( options.credentials === "include" ) {
            break CREDENTIALS;
        }
        else if ( options.credentials !== "omit" ) {
            return error( result( [ 400, `Invalid credentials option` ] ), url, options, req );
        }

        // remove credentials
        req.removeHeader( "authorization" );
        req.removeHeader( "proxy-authorization" );
        req.removeHeader( "cookie" );
        req.removeHeader( "cookie2" );
    }

    // referer
    if ( options.referrerPolicy === "strict-origin-when-cross-origin" ) {
        if ( sameOrigin && !downgrade ) req.setHeader( "Referer", options.referrer );
        else req.setHeader( "Referer", options._origin );
    }
    else if ( options.referrerPolicy === "no-referrer" ) {
        req.removeHeader( "Referer" );
    }
    else if ( options.referrerPolicy === "unsafe-url" ) {
        req.setHeader( "Referer", options.referrer );
    }
    else if ( options.referrerPolicy === "same-origin" ) {
        if ( sameOrigin ) req.setHeader( "Referer", options.referrer );
        else req.removeHeader( "Referer" );
    }
    else if ( options.referrerPolicy === "origin" ) {
        req.setHeader( "Referer", options._origin );
    }
    else if ( options.referrerPolicy === "origin-when-cross-origin" ) {
        if ( sameOrigin ) req.setHeader( "Referer", options.referrer );
        else req.setHeader( "Referer", options._origin );
    }
    else if ( options.referrerPolicy === "no-referrer-when-downgrade" ) {
        if ( downgrade ) req.removeHeader( "Referer" );
        else req.setHeader( "Referer", options.referrer );
    }
    else if ( options.referrerPolicy === "strict-origin" ) {
        if ( downgrade ) req.removeHeader( "Referer" );
        else req.setHeader( "Referer", options._origin );
    }
    else {
        return error( result( [ 400, `Invalid referrerPolicy option` ] ), url, options, req );
    }

    // body
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

        if ( contentLength != null ) req.setHeader( "content-length", String( contentLength ) );
        if ( contentType != null && !req.hasHeader( "content-type" ) ) req.setHeader( "Content-Type", contentType );
    }

    return new Promise( resolve => {
        req.once( "error", e => {
            req.destroy();

            resolve( error( result.catch( e, { "log": false } ), url, options ) );
        } );

        req.once( "response", res => {

            // store cookies
            if ( options.cookies && res.headers[ "set-cookie" ] ) {
                options.cookies.add( Headers.parseSetCookie( res.headers[ "set-cookie" ] ), url );
            }

            // redirect
            REDIRECT: if ( REDIRECT_STATUSES.has( res.statusCode ) ) {
                let location;

                try {
                    location = res.headers.location ? new URL( res.headers.location, url ) : null;
                }
                catch ( e ) {}

                // error
                if ( options.redirect === "error" ) {
                    return req.destroy( `Requested responds with a redirect, redirect mode is set to error` );
                }

                // manual
                else if ( options.redirect === "manual" ) {
                    break REDIRECT;
                }

                // follow
                else if ( location ) {
                    if ( --options.follow < 0 ) {
                        return req.destroy( `Maximum redirect reached` );
                    }

                    if ( res.statusCode !== 303 && options.body instanceof Stream ) {
                        return req.destroy( `Can not follow redirect with body being a readable stream` );
                    }

                    if ( res.statusCode === 303 || ( ( res.statusCode === 301 || res.statusCode === 302 ) && options.method === "POST" ) ) {
                        options.method = "GET";
                        options.body = undefined;
                        options.redirected = true;
                    }

                    req.destroy();

                    return resolve( request( location, options ) );
                }
            }

            resolve( new Response( res, url, options ) );
        } );

        // finish request
        if ( options.body instanceof Stream ) {
            pipeline( options.body, req );
        }
        else {
            req.end( options.body );
        }
    } );
}

function error ( res, url, options, req ) {
    if ( req ) {
        req.once( "error", e => {} );

        req.destroy();
    }

    return Response.error( res, url, options );
}

Object.defineProperty( fetch, "Agent", {
    "value": Agent,
    "configurable": false,
    "writable": false,
} );
