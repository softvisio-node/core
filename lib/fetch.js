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

    // remove credentials
    // if ( url.username || url.password ) {
    //     url = new URL( url );

    //     url.username = "";
    //     url.password = "";
    // }

    options = { ...options };

    options.method ||= "GET";
    options.method = options.method.toUpperCase();

    // body
    if ( options.body != null && ( options.method === "GET" || options.method === "HEAD" ) ) {
        return new Response( [400, `Request with GET/HEAD method cannot have body`] );
    }

    options.redirect ||= "follow";
    options.follow ??= 20;
    options.redirected = false;
    options.compress ??= true;

    // agent
    if ( options.agent ) {
        Agent ??= ( await import( "#lib/http/agent" ) ).default;

        if ( objectIsPlain( options.agent ) ) {
            options.agentBuilder = new Agent( options.agent ).fetchAgent;
        }
        else if ( options.agent instanceof Agent ) {
            options.agentBuilder = options.agent.fetchAgent;
        }
        else if ( typeof options.agent === "function" ) {
            options.agentBuilder = options.agent;
        }
    }

    return request( url, options );
}

async function request ( url, options ) {
    if ( options.agentBuilder ) options.agent = options.agentBuilder( url );

    const req = ( url.protocol === "http:" ? http : https ).request( url, options );

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

            resolve( new Response( result.catch( e, { "silent": true, "keepError": true } ) ) );
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
