import Events from "./events.js";
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

        res.meta.delay = new Date() - start;

        return res;
    }

    healthcheck () {
        return this.#call( "/healthcheck" );
    }

    publish ( name, args ) {
        this.#call( "/publish", [name, ...args], true );
    }

    async call ( method, args ) {
        return this.#call( method, args );
    }

    voidCall ( method, args ) {
        this.#call( method, args, true );
    }

    // private
    async #call ( method, args, voidCall ) {
        var url;

        // add api version to the method
        if ( method.charAt( 0 ) !== "/" ) {
            url = this.#url.href + `${this.version}/${method}`;
        }
        else {
            url = this.#url.href + method.substring( 1 );
        }

        const headers = {
            "Content-Type": "application/json",
        };

        if ( voidCall ) headers["X-API-Void-Call"] = "true";

        if ( this.token ) headers.Authorization = "Bearer " + this.token;

        var res;

        try {
            res = await fetch( url, {
                "method": args.length ? "post" : "get",
                "mode": "cors",
                headers,
                "body": args.length ? JSON.stringify( args ) : null,
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

            res = result.parseRpc( msg );
        }
        catch ( e ) {
            res = result.catch( e );
        }

        return res;
    }
}
