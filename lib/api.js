import Common from "#browser/api/common";
import Upload from "#browser/api/upload";
import fetch from "#lib/fetch";
import FormData from "#lib/form-data";
import DnsWatcher from "#lib/dns/watcher";
import Blob from "#lib/blob";
import stream from "node:stream";
import { isIP } from "node:net";
import { WebSocket } from "undici";

class WebSocketDispatcher extends fetch.Dispatcher {
    #hostname;

    constructor ( { api, hostname, ...options } ) {
        super( {
            ...options,
            "checkCertificate": api.checkCertificate,
        } );

        this.#hostname = hostname;
    }

    // protected
    _processHeaders ( headers ) {
        if ( this.#hostname ) {
            headers.set( "host", this.#hostname );
        }
    }
}

class ApiClientUpload extends Upload {
    #size;
    #formData;
    #dispatcher;

    constructor ( api, url, method, formData, signal ) {
        super( api, url, method, signal );

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
    async _start ( url ) {
        this._setProgress( this.#size / 2 );

        const formData = this.#formData;
        this.#formData = null;

        const headers = {
            "Host": this.api.hostname,
        };

        if ( this.api.token ) {
            headers.Authorization = "Bearer " + this.api.token;
        }

        var res;

        try {
            this.#dispatcher ??= new fetch.Dispatcher( {
                "checkCertificate": this.api.checkCertificate,
            } );

            res = await fetch( url, {
                "method": "post",
                headers,
                "body": formData,
                "signal": this.abortSignal,
                "dispatcher": this.#dispatcher,
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
                    throw result( -32_807 );
                }
            }
            else {

                // request error
                if ( !res.ok ) {
                    throw res;
                }

                // invalid content type
                else {
                    throw result( -32_803 );
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
    #dispatcher;

    constructor ( url, options ) {
        super( url, options );

        this.connect();
    }

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

    _createWebSocket ( url, protocols ) {
        this.#dispatcher ||= new WebSocketDispatcher( this, isIP( this.hostname ) ? null : this.hostname );

        return new WebSocket( url, {
            protocols,
            "dispatcher": this.#dispatcher,
        } );
    }

    async _dnsLookup () {
        return this.#dnsWatcher.lookup( { "silent": true } );
    }

    _dnsReset () {
        this.#dnsWatcher.reset();
    }

    // private
    get #dnsWatcher () {
        if ( !this.#_dnsWatcher ) {
            this.#_dnsWatcher = new DnsWatcher( this.hostname ).on( "add", addresses => this.connect() ).unref();

            if ( this.realMaxConnections !== 1 ) this.#_dnsWatcher.start();
        }

        return this.#_dnsWatcher;
    }
}
