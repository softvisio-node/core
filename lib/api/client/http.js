const Events = require( "../../events" );
const { toMsgPack, fromMsgPack } = require( "../../msgpack" );
const result = require( "../../result" );

module.exports = class extends Events {
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
    async _callHttp ( method, args ) {
        const fetch = this._fetch;

        try {
            const headers = {
                "Content-Type": this.json ? "application/json" : "application/msgpack",
            };

            if ( this.token ) headers["Authorization"] = "Bearer " + this.token;

            const res = await fetch( this.httpUrl.href + method, {
                "method": "post",
                "mode": "same-origin",
                headers,
                "body": this.json ? JSON.stringify( args ) : toMsgPack( args ),
            } );

            if ( !res.ok ) return result( [res.status, res.reason] );

            const contentType = res.headers.get( "content-type" );

            let data;

            if ( contentType === "application/json" ) {
                data = await res.json();
            }
            else if ( contentType === "application/msgpack" ) {
                data = fromMsgPack( await res.arrayBuffer() );
            }
            else throw `Content type is invalid`;

            return result.parseResult( data );
        }
        catch ( e ) {
            return result( [500, e + ""] );
        }
    }

    async _callVoidHttp ( method, args ) {
        this._callHttp( method, args );
    }
};
