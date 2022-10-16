import Common from "#browser/api/common";
import _Upload from "#browser/api/upload";
import fetch from "#lib/fetch";
import Blob from "#lib/blob";
import FormData from "#lib/form-data";
import DnsWatcher from "#lib/dns/watcher";

class ApiClientUpload extends _Upload {
    #size;
    #formData;
    #abortController;

    constructor ( api, method, fields ) {
        super( api, method );

        const formData = new FormData();

        for ( const name in fields ) {
            const value = fields[name];

            if ( value instanceof Blob ) {
                formData.append( name, value );
            }
            else {
                try {
                    formData.append( name, JSON.stringify( value ), { "type": "application/json" } );
                }
                catch ( e ) {
                    this._setResult( result( [400, `Unable to encode JSON`] ) );
                }
            }
        }

        this.#formData = formData;
        this.#size = formData.length;
    }

    get size () {
        return this.#size;
    }

    // protected
    async _start ( api, url ) {
        this.#abortController = new AbortController();

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
                "signal": this.#abortController.signal,
            } );

            this.#abortController = null;

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

            res = result.parseRpc( msg );
        }
        catch ( e ) {
            res = result.catch( e );
        }

        this._setResult( res );
    }

    _abort () {
        if ( !this.#abortController ) return false;

        this.#abortController.abort();
        this.#abortController = null;

        return true;
    }
}

export default class ApiClient extends Common {
    #_dnsWatcher;

    // properties
    get isBrowser () {
        return false;
    }

    get Upload () {
        return ApiClientUpload;
    }

    // protected
    _resolveUrl ( url ) {
        url = new URL( url );

        if ( !url.pathname.endsWith( "/" ) ) url.pathname += "/";

        return url;
    }

    get #dnsWatcher () {
        if ( !this.#_dnsWatcher ) {
            this.#_dnsWatcher = new DnsWatcher( this.hostname ).on( "add", addresses => this._connectWebSocket() ).unref();

            if ( this.maxConnections !== 1 ) this.#_dnsWatcher.start();
        }

        return this.#_dnsWatcher;
    }

    async _dnsLookup ( options ) {
        return this.#dnsWatcher.lookup( options );
    }

    _dnsReset () {
        this.#dnsWatcher.reset();
    }
}
