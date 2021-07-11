import Events from "#lib/events";
import MSGPACK from "#lib/msgpack";
import result from "#lib/result";
import fetch from "#lib/fetch";

export default class extends Events {
    #_url;

    // properties
    get #url () {
        if ( !this.#_url ) {
            const url = new URL( this.protocol + "//" + this.hostname );

            url.port = this.port;
            url.pathname = this.pathname;

            if ( url.protocol === "ws:" ) url.protocol = "http:";
            else if ( url.protocol === "wss:" ) url.protocol = "https:";

            this.#_url = url;
        }

        return this.#_url;
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

    // protected
    _urlUpdated () {
        this.#_url = null;
    }

    // private
    async #call ( method, args, voidCall ) {

        // add api version to the method
        if ( method.charAt( 0 ) !== "/" ) method = `${this.version}/${method}`;
        else method = method.substr( 1 );

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

        var res;

        try {
            res = await fetch( this.#url.href + method, {
                "method": HTTPmethod,
                "mode": "cors",
                headers,
                body,
            } );

            if ( voidCall ) return;

            const contentType = res.headers.get( "content-type" ) ?? "";

            let msg;

            // json
            if ( contentType.startsWith( "application/json" ) ) {
                try {
                    msg = await res.json();
                }
                catch ( e ) {

                    // message decode error
                    throw result( -32807 );
                }
            }

            // msgpack
            else if ( contentType.startsWith( "application/msgpack" ) ) {
                try {
                    msg = MSGPACK.decode( await res.arrayBuffer() );
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

            res = result.parseRPC( msg );
        }
        catch ( e ) {
            res = result.catch( e );
        }

        return res;
    }
}
