import Headers from "#lib/fetch/headers";
import Request from "#lib/fetch/request";
import Response from "#lib/fetch/response";
export { Headers, Request, Response };
import http from "http";
import https from "https";
import { objectIsPlain } from "#lib/utils";
import Blob from "#lib/blob";

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

// Accept-Encoding    gzip,deflate,br (when options.compress === true)
// Accept    */*
// Connection    close (when no options.agent is present)
// Content-Length    (automatically calculated, if possible)
// Host    (host and port information from the target URI)
// Transfer-Encoding    chunked (when req.body is a stream)
// User-Agent    node-fetch

// const CHROME = {
//     "accept-language": "en-US,en;q=0.9",
//     "user-agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.137 Safari/537.36`,
// };

var Agent;

export default async function fetch ( url, options = {} ) {
    if ( typeof url === "string" ) url = new URL( url );

    // agent
    if ( options.agent ) {
        Agent ??= ( await import( "#lib/http/agent" ) ).default;

        if ( objectIsPlain( options.agent ) ) {
            options.agent = new Agent( options.agent ).fetchAgent( url );
        }
        else if ( options.agent instanceof Agent ) {
            options.agent = options.agent.fetchAgent( url );
        }
    }

    // chrome
    // if ( options.chrome ) {
    //     _options ||= {};

    //     // clone headers
    //     _options.headers = {
    //         ...( options.headers || {} ),
    //         ...CHROME,
    //     };
    // }

    // body
    if ( options.body instanceof Blob ) {

        //     _options ||= {};
        //     _options.headers ||= options.headers ? { ...options.headers } : {};
        //     if ( options.body.size ) _options.headers["Content-Length"] = options.body.size;
        //     if ( options.body.type ) _options.headers["Content-Type"] = options.body.type;
        //     _options.body = await options.body.stream();
    }

    // clone options
    // if ( _options ) options = { ...options, ..._options };

    return new Promise( resolve => {
        const req = ( url.protocol === "http:" ? http : https ).request( url, options );

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
