import Events from "#lib/events";
import MSGPACK from "#lib/msgpack";
import result from "#lib/result";
import fetch from "#lib/fetch";

export default class extends Events {
    #httpUrl;

    get httpUrl () {
        if ( !this.#httpUrl ) {
            const url = new URL( this.url );

            if ( url.protocol === "ws:" ) url.protocol = "http:";
            else if ( url.protocol === "wss:" ) url.protocol = "https:";

            url.username = "";
            url.password = "";
            url.search = "";
            url.hash = "";

            this.#httpUrl = url;
        }

        return this.#httpUrl;
    }

    set url ( value ) {
        this.#httpUrl = null;
    }

    // protected
    async _callHTTP ( method, params ) {
        return this.#call( method, params );
    }

    _callVoidHTTP ( method, params ) {
        this.#call( method, params, true );
    }

    // private
    async #call ( method, params, voidCall ) {

        // add api version to the method
        if ( method.charAt( 0 ) !== "/" ) {
            method = `/${this.version}/${method}`;
        }

        if ( !params.length ) params = undefined;

        try {
            const headers = {
                "Content-Type": this.json ? "application/json" : "application/msgpack",
            };

            if ( voidCall ) headers["API-Call-Void"] = "true";

            if ( this.token ) headers.Authorization = "Bearer " + this.token;

            let body;

            if ( typeof params !== "undefined" ) body = this.json ? JSON.stringify( params ) : MSGPACK.encode( params );

            const res = await fetch( this.httpUrl.href + method, {
                "method": "post",
                "mode": "cors",
                headers,
                body,
            } );

            if ( voidCall ) return;

            if ( !res.ok ) return result( res );

            const contentType = res.headers.get( "content-type" );

            let data;

            if ( contentType === "application/json" ) {
                data = await res.json();
            }
            else if ( contentType === "application/msgpack" ) {
                data = MSGPACK.decode( await res.arrayBuffer() );
            }
            else throw `Content type is invalid`;

            return result.parse( data );
        }
        catch ( e ) {
            return result( [500, e + ""] );
        }
    }
}
