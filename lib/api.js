import Common from "#browser/api/common";
import _Upload from "#browser/api/upload";
import fetch from "#lib/fetch";
import File from "#lib/file";
import FormData from "#lib/form-data";
import msgpack from "#lib/msgpack";
import DnsWatcher from "#lib/dns/watcher";

class ApiClientUpload extends _Upload {
    #size;

    #formData;
    #abortController;

    constructor ( api, method, file, args ) {
        if ( typeof file === "string" ) file = { "path": file };

        file = File.new( file );

        super( api, method, file );

        const formData = new FormData();

        if ( args.length ) {
            if ( api.json ) {
                formData.append( "params", JSON.stringify( args ), { "Content-Type": "application/json" } );
            }
            else {
                formData.append( "params", msgpack.encode( args ), { "Content-Type": "application/msgpack" } );
            }
        }

        formData.append( "file", file );

        // check, that we know content length
        if ( !formData.length ) {
            this._setResult( result( [400, `Content length is unknown`] ) );
        }
        else {
            this.#size = formData.length;

            this.#formData = formData;
        }
    }

    get size () {
        return this.#size;
    }

    // protected
    async _start ( api, method ) {
        this.#abortController = new AbortController();

        this._setProgress( this.#size / 2 );

        const formData = this.#formData;
        this.#formData = null;

        const headers = { ...formData.headers, "Host": api.hostname };

        if ( api.token ) headers.Authorization = "Bearer " + api.token;

        var res;

        try {
            res = await fetch( api.uploadUrl.href + method, {
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
            else if ( contentType.startsWith( "application/msgpack" ) ) {
                try {
                    msg = msgpack.decode( await res.arrayBuffer() );
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
    #dnsWatcher;

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

    get _dnsWatcher () {
        if ( !this.#dnsWatcher ) {
            this.#dnsWatcher = new DnsWatcher( this.hostname ).on( "add", adresses => this._connectWebSocket() ).unref();

            if ( this.maxConnections !== 1 ) this.#dnsWatcher.start();
        }

        return this.#dnsWatcher;
    }

    async _lookup ( options ) {
        return this._dnsWatcher.resolve( options );
    }

    _reset () {
        this._dnsWatcher.reset();
    }
}
