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

            if ( url.protocol === "ws:" ) {
                url.protocol = "http:";
            }
            else if ( url.protocol === "wss:" ) {
                url.protocol = "https:";
            }

            if ( this.locale ) {
                url.searchParams.set( "locale", this.locale );
            }

            this.#_url = url;
        }

        return this.#_url;
    }

    // public
    publish ( name, args ) {
        this.#call( "/publish", [ name, ...args ], true );
    }

    async call ( method, args ) {
        return this.#call( method, args );
    }

    voidCall ( method, args ) {
        this.#call( method, args, true );
    }

    // private
    async #call ( method, args, isVoidCall ) {
        var url = new URL( this.#url ),
            signal;

        if ( typeof method === "object" ) {
            ( { method, "arguments": args, signal } = method );
        }

        // aborted
        if ( signal?.aborted ) return result( -32817 );

        // add method
        url.pathname += this.prepateMethodName( method );

        const headers = {
            "Content-Type": "application/json",
        };

        if ( isVoidCall ) headers[ "X-API-Void-Call" ] = "true";

        if ( this.token ) headers.Authorization = "Bearer " + this.token;

        var res;

        try {
            res = await fetch( url, {
                "method": args.length ? "post" : "get",
                "mode": "cors",
                headers,
                "body": args.length ? JSON.stringify( args ) : null,
                signal,
                "checkCertificate": this.checkCertificate,
            } );

            if ( isVoidCall ) return;

            // aborted
            if ( !res.ok && signal?.aborted ) return result( -32817 );

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

            res = result.fromJsonRpc( msg );
        }
        catch ( e ) {
            res = result.catch( e );
        }

        // session is disabled
        if ( res.status === -32813 ) this.emit( "sessionDisable" );

        // session was deleted
        if ( res.status === -32815 ) this.emit( "sessionDelete" );

        // access denied
        if ( res.status === -32811 ) this.emit( "accessDenied" );

        // authorization
        if ( !isVoidCall && res.status === -32812 ) {
            if ( this.onAuthorization && ( await this.onAuthorization() ) ) {

                // repeat request
                return this.#call( method, args );
            }
        }

        return res;
    }
}
