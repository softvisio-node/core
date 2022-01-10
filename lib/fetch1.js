import Headers from "#lib/fetch/headers";
import Request from "#lib/fetch/request";
import Response from "#lib/fetch/response";
export { Headers, Request, Response };
import http from "http";
import https from "https";
import { objectIsPlain } from "#lib/utils";
import Blob from "#lib/blob";
import FormData from "#lib/form-data";
import { Stream } from "#lib/stream";

// // These properties are part of the Fetch Standard
//     method: 'GET',
//     headers: {},            // Request headers. format is the identical to that accepted by the Headers constructor (see below)
//     body: null,             // Request body. can be null, or a Node.js Readable stream
//     redirect: 'follow',     // Set to `manual` to extract redirect headers, `error` to reject redirect
//     signal: null,           // Pass an instance of AbortSignal to optionally abort requests

//     // The following properties are node-fetch extensions
//     follow: 20,             // maximum redirect count. 0 to not follow redirect
//     compress: true,         // support gzip/deflate content encoding. false to disable
//     size: 0,                // maximum response body size in bytes. 0 to disable
//     agent: null,            // http(s).Agent instance or function that returns an instance (see below)
//     highWaterMark: 16384,   // the maximum number of bytes to store in the internal buffer before ceasing to read from the underlying resource.
//     insecureHTTPParser: false    // Use an insecure HTTP parser that accepts invalid HTTP headers when `true`.

const DEFAULT_USER_AGENT = "node-fetch";
const CHROME_USER_AGENT = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.137 Safari/537.36`;

var Agent;

export default async function fetch ( url, options = {} ) {
    if ( typeof url === "string" ) url = new URL( url );

    options = { ...options };

    options.method ||= "GET";
    options.method = options.method.toUpperCase();

    // body
    if ( options.body !== null ) {

        // XXX check method body allowed
    }

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
    if ( !req.getHeader( "user-agent" ) ) req.setHeader( "User-Agent", options.chrome ? CHROME_USER_AGENT : DEFAULT_USER_AGENT );

    // accept-language
    if ( !req.getHeader( "accept-language" ) ) req.setHeader( "Accept-Language", "en-US,en;q=0.9" );

    // accept-encoding
    if ( options.compress ) req.setHeader( "Accept-Encoding", "gzip,deflate,br" );

    // accept
    if ( !req.getHeader( "accept" ) ) req.setHeader( "Accept", "*/*" );

    // connection
    if ( !options.agent ) req.setHeader( "Connection", "close" );

    // body
    if ( options.body !== null ) {
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
            contentType = "application/x-www-form-urlencoded";
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
        }

        if ( contentLength != null ) req.setHeader( "Content-Length", String( contentLength ) );
        if ( contentType != null && !req.getHeader( "content-type" ) ) req.setHeader( "Content-Type", contentType );
    }

    console.log( req );
    process.exit();

    return new Promise( resolve => {
        req.once( "error", e => {
            resolve( result.catch( e, { "silent": true, "keepError": true } ) );
        } );

        req.once( "response", res => {
            resolve( new Response( res ) );

            // res.resume();

            // res.once( "end", () => {

            //     // XXX
            //     // if ( !res.complete ) console.error( "The connection was terminated while the message was still being sent" );

            //     // console.log( res.rawHeaders );

            //     resolve( result( [res.statusCode, res.statusMessage] ) );
            // } );
        } );

        // XXX pipe / write body

        req.end();
    } );
}
