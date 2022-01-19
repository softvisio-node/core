import Response from "#lib/http/fetch/response";
import http from "node:http";
import https from "node:https";
import { objectIsPlain } from "#lib/utils";
import Blob from "#lib/blob";
import FormData from "#lib/form-data";
import { Stream } from "#lib/stream";
import fs from "fs";

var resources;
var RESOURCES = {
    "userAgent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.137 Safari/537.36`,
};

const REDIRECT = new Set( [301, 302, 303, 307, 308] );

function loadResources () {
    const location = resources.location + "/" + resources.get( "http" ).files[0];

    if ( !fs.existsSync( location ) ) return;

    RESOURCES = JSON.parse( fs.readFileSync( location, "utf8" ) );
}

var Agent;

export default async function fetch ( url, options = {} ) {

    // init resources
    if ( !resources ) {
        resources = ( await import( "#lib/http/resources" ) ).default;

        resources.on( "update", id => loadResources() ).startUpdate();

        loadResources();
    }

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

    // body
    if ( options.body != null && ( options.method === "GET" || options.method === "HEAD" ) ) {
        return Response.error( result( [400, `Request with GET/HEAD method cannot have body`] ) );
    }

    // agent
    if ( options.agent ) {
        Agent ??= ( await import( "#lib/http/agent" ) ).default;

        if ( objectIsPlain( options.agent ) ) {
            options._agentBuilder = new Agent( options.agent ).fetchAgent;
        }
        else if ( options.agent instanceof Agent ) {
            options._agentBuilder = options.agent.fetchAgent;
        }
        else if ( typeof options.agent === "function" ) {
            options._agentBuilder = options.agent;
        }
    }

    return request( url, options );
}

async function request ( url, options ) {

    // data url
    if ( url.protocol === "data:" ) {
        const idx = url.pathname.indexOf( "," );

        if ( idx === -1 ) {
            return new Response( 200, url );
        }
        else {
            const [type, base64] = url.pathname.substring( 0, idx ).split( ";" );

            const body = base64 ? Buffer.from( url.pathname.substring( idx + 1 ), "base64" ) : Buffer.from( decodeURIComponent( url.pathname.substring( idx + 1 ) ) );

            return new Response( 200, url, {
                "headers": { "content-type": type, "content-length": body.length },
                body,
            } );
        }
    }

    // invalid protocol
    else if ( url.protocol !== "http:" && url.protocol !== "https:" ) {
        return Response.error( result( [400, `Invalid URL protocol`] ) );
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

    // user-agent
    if ( !req.getHeader( "user-agent" ) ) req.setHeader( "User-Agent", RESOURCES.userAgent );

    // accept-language
    if ( !req.getHeader( "accept-language" ) ) req.setHeader( "Accept-Language", "en-US,en;q=0.9" );

    // accept-encoding
    if ( options.compress ) req.setHeader( "Accept-Encoding", "gzip,deflate,br" );

    // accept
    if ( !req.getHeader( "accept" ) ) req.setHeader( "Accept", "*/*" );

    // connection
    if ( !options.agent ) req.setHeader( "Connection", "close" );

    const sameOrigin = options._origin === url.origin,
        downgrade = options._originSecure && url.protocol !== "http:";

    // credentials
    if ( ( options.credentials === "same-origin" && !sameOrigin ) || options.credentials === "omit" ) {
        req.removeHeader( "authorization" );
        req.removeHeader( "proxy-authorization" );
        req.removeHeader( "cookie" );
        req.removeHeader( "cookie2" );
    }
    else if ( options.credentials !== "include" ) {
        return Response.error( result( [400, `Invalid credentials option`] ) );
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
        return Response.error( result( [400, `Invalid referrerPolicy option`] ) );
    }

    // body
    if ( options.body != null ) {
        const body = options.body;

        let contentLength, contentType;

        // buffer
        if ( Buffer.isBuffer( body ) ) {
            contentLength = body.length;
        }

        // blob
        else if ( body instanceof Blob ) {
            options.body = await body.stream();

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
        else if ( body instanceof FormData ) {
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

        if ( contentLength != null ) req.setHeader( "Content-Length", String( contentLength ) );
        if ( contentType != null && !req.getHeader( "content-type" ) ) req.setHeader( "Content-Type", contentType );
    }

    return new Promise( resolve => {
        req.once( "error", e => {
            req.destroy();

            resolve( Response.error( result.catch( e, { "silent": true, "keepError": true } ) ) );
        } );

        req.once( "response", res => {

            // redirect
            if ( REDIRECT.has( res.statusCode ) ) {
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
                    return req.destroy( `Manual redirect is not implemented` );
                }

                // follow
                else if ( location ) {
                    if ( --options.follow < 0 ) {
                        return req.destroy( `Maximum redirect reached` );
                    }

                    if ( res.statusCode !== 303 && options.body instanceof Stream ) {
                        return req.destroy( `Cannot follow redirect with body being a readable stream` );
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

        // send body
        if ( options.body != null ) {
            if ( Buffer.isBuffer( options.body ) ) req.end( options.body );
            else options.body.pipe( req );
        }

        // no body
        else req.end();
    } );
}
