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
    async _callHTTP ( method, args ) {
        return this.#call( method, args );
    }

    _callVoidHTTP ( method, args ) {
        this.#call( method, args, true );
    }

    // private
    async #call ( method, args, voidCall ) {

        // add api version to the method
        if ( method.charAt( 0 ) !== "/" ) {
            method = `/${this.version}/${method}`;
        }

        if ( !args.length ) args = undefined;

        try {
            const headers = {
                "Content-Type": this.json ? "application/json" : "application/msgpack",
            };

            if ( voidCall ) headers["API-Call-Void"] = "true";

            if ( this.token ) headers.Authorization = "Bearer " + this.token;

            let body;

            if ( typeof args !== "undefined" ) body = this.json ? JSON.stringify( args ) : MSGPACK.encode( args );

            const res = await fetch( this.httpUrl.href + method, {
                "method": "post",
                "mode": "cors",
                headers,
                body,
            } );

            if ( voidCall ) return;

            if ( !res.ok ) return result( [res.status, res.statusText] );

            const contentType = res.headers.get( "content-type" );

            let data;

            if ( contentType === "application/json" ) {
                data = await res.json();
            }
            else if ( contentType === "application/msgpack" ) {
                data = MSGPACK.decode( await res.arrayBuffer() );
            }
            else throw `Content type is invalid`;

            return result.parseResult( data );
        }
        catch ( e ) {
            return result( [500, e + ""] );
        }
    }
}
