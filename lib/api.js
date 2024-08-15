import Common from "#browser/api/common";
import _Upload from "#browser/api/upload";
import fetch from "#lib/fetch";
import FormData from "#lib/form-data";
import DnsWatcher from "#lib/dns/watcher";
import Blob from "#lib/blob";
import stream from "node:stream";

class ApiClientUpload extends _Upload {
    #size;
    #formData;

    constructor ( api, method, formData ) {
        var signal;

        if ( typeof method === "object" ) {
            ( { method, formData, signal } = method );
        }

        super( api, method, signal );

        if ( formData instanceof FormData ) {
            this.#formData = formData;
        }
        else if ( Array.isArray( formData ) ) {
            this.#formData = new FormData();

            for ( var [ name, body, options ] of formData ) {
                if ( body instanceof Blob || body instanceof stream.Readable ) {
                    this.#formData.append( name, body, options );
                }
                else {
                    this.#formData.append( name, JSON.stringify( body ), { "type": "application/json" } );
                }
            }
        }
        else {
            this.#formData = new FormData();

            for ( const [ name, body ] of Object.entries( formData ) ) {
                if ( body instanceof Blob || body instanceof stream.Readable ) {
                    this.#formData.append( name, body );
                }
                else {
                    this.#formData.append( name, JSON.stringify( body ), { "type": "application/json" } );
                }
            }
        }

        this.#size = this.#formData.length;
    }

    // properties
    get size () {
        return this.#size;
    }

    // protected
    async _start ( api, url ) {
        this._setProgress( this.#size / 2 );

        const formData = this.#formData;
        this.#formData = null;

        const headers = { "Host": api.hostname };

        if ( api.token ) headers.Authorization = "Bearer " + api.token;

        var res;

        try {
            res = await fetch( url, {
                "method": "post",
                headers,
                "body": formData,
                "signal": this.abortSignal,
            } );

            const contentType = res.headers.get( "content-type" ) ?? "";

            let msg;

            // read response body
            if ( contentType.startsWith( "application/json" ) ) {
                try {
                    msg = await res.json();
                }
                catch ( e ) {

                    // message decode error
                    throw result( -32807 );
                }
            }
            else {

                // request error
                if ( !res.ok ) {
                    throw res;
                }

                // invalid content type
                else {
                    throw result( -32803 );
                }
            }

            // set progress to 100%
            this._setProgress( this.#size );

            res = result.fromJsonRpc( msg );
        }
        catch ( e ) {
            res = result.catch( e );
        }

        this._setResult( res );
    }
}

export default class ApiClient extends Common {
    #_dnsWatcher;

    // properties
    get Upload () {
        return ApiClientUpload;
    }

    // protected
    _resolveUrl ( url ) {
        url = new URL( url );

        if ( !url.pathname.endsWith( "/" ) ) url.pathname += "/";

        return url;
    }

    async _dnsLookup ( options ) {
        return this.#dnsWatcher.lookup( options );
    }

    _dnsReset () {
        this.#dnsWatcher.reset();
    }

    // private
    get #dnsWatcher () {
        if ( !this.#_dnsWatcher ) {
            this.#_dnsWatcher = new DnsWatcher( this.hostname ).on( "add", addresses => this._connectWebSocket() ).unref();

            if ( this.realMaxConnections !== 1 ) this.#_dnsWatcher.start();
        }

        return this.#_dnsWatcher;
    }
}
