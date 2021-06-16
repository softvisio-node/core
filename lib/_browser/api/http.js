import Events from "#lib/events";
import MSGPACK from "#lib/msgpack";
import result from "#lib/result";
import fetch from "#lib/fetch";

export default class extends Events {
    #httpUrl;

    // properties
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

    // public
    async ping () {
        const start = new Date(),
            res = await this.#call( "/ping" );

        res.delay = new Date() - start;

        return res;
    }

    healthcheck () {
        return this.#call( "/healthcheck" );
    }

    publish ( name, args ) {
        this.#call( "/event", [name, ...args], true );
    }

    async call ( method, args ) {
        return this.#call( method, args );
    }

    callVoid ( method, args ) {
        this.#call( method, args, true );
    }

    // private
    async #call ( method, args, voidCall ) {

        // add api version to the method
        if ( method.charAt( 0 ) !== "/" ) method = `/${this.version}/${method}`;

        const headers = {
            "Content-Type": this.json ? "application/json" : "application/msgpack",
        };

        if ( voidCall ) headers["API-Call-Void"] = "true";

        if ( this.token ) headers.Authorization = "Bearer " + this.token;

        let HTTPmethod, body;

        if ( args.length ) {
            HTTPmethod = "post";
            body = this.json ? JSON.stringify( args ) : MSGPACK.encode( args );
        }
        else {
            HTTPmethod = "get";
        }

        const res = await fetch( this.httpUrl.href + method, {
            "method": HTTPmethod,
            "mode": "cors",
            headers,
            body,
        } );

        if ( voidCall ) return;

        const contentType = res.headers.get( "content-type" );

        let msg;

        try {

            // json
            if ( contentType.startsWith( "application/json" ) ) {
                msg = await res.json();
            }

            // msgpack
            else if ( contentType.startsWith( "application/msgpack" ) ) {
                msg = MSGPACK.decode( await res.arrayBuffer() );
            }

            // invalid content type
            else {
                return result( [500, `Server response with invalid content type`] );
            }
        }
        catch ( e ) {
            return result( [500, `Unable to decode server response`] );
        }

        return result.parseRPC( msg );
    }
}
