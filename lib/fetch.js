import "#lib/result";
import Agent from "#lib/http/agent";
import Blob from "#lib/blob";
import { objectIsPlain } from "#lib/utils";

// import _fetch, { Response } from "node-fetch";

// XXX https://github.com/node-fetch/fetch-blob/issues/114
globalThis.ReadableStream = true;
const __fetch = await import( "node-fetch" );
globalThis.ReadableStream = null;
const _fetch = __fetch.default;
const Response = __fetch.Response;

const CHROME = {
    "accept-language": "en-US,en;q=0.9",
    "user-agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.142 Safari/537.36`,
};

Response.prototype.toString = function () {
    return this.status + " " + this.statusText;
};

Response.prototype.toJSON = function () {
    return {
        "status": this.status,
        "status_text": this.statusText,
    };
};

Response.prototype.blob = async function () {
    const type = ( this.headers && this.headers.get( "content-type" ) ) || "";

    const buffer = await this.buffer();

    return new Blob( buffer, { type } );
};

// options:
// proxy: null
// rejectUnauthorized: bool
// chrome: bool
export default async function fetch ( url, options = {} ) {
    var _options;

    // agent
    if ( options.agent ) {
        if ( objectIsPlain( options.agent ) ) {
            _options = { "agent": new Agent( options.agent ).fetchAgent };
        }
        else if ( options.agent instanceof Agent ) {
            _options = { "agent": options.agent.fetchAgent };
        }
    }

    // chrome
    if ( options.chrome ) {
        _options ||= {};

        // clone headers
        _options.headers = {
            ...( options.headers || {} ),
            ...CHROME,
        };
    }

    // body
    if ( options.body instanceof Blob ) {
        _options ||= {};
        _options.headers ||= options.headers ? { ...options.headers } : {};

        if ( options.body.size ) _options.headers["Content-Length"] = options.body.size;
        if ( options.body.type ) _options.headers["Content-Type"] = options.body.type;

        _options.body = await options.body.stream();
    }

    // clone options
    if ( _options ) options = { ...options, ..._options };

    var res;

    try {
        res = await _fetch( url, options );
    }
    catch ( e ) {
        res = new Response( null, {
            "status": 599,
            "statusText": e.message,
        } );
    }

    return res;
}

fetch.Agent = Agent;
