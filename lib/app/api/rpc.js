import mixins from "#lib/mixins";
import Server from "#lib/app/server";
import Events from "#lib/events";

import Auth from "./auth.js";

import HealthCheckMixin from "./local/health-check.js";
import APISchemaMixin from "./local/schema.js";
import ConnectionMixin from "./mixins/connection.js";

const SERVICE_API_PORT = 8080;

export default class RPC extends mixins( HealthCheckMixin, APISchemaMixin, ConnectionMixin, Events ) {
    #app;
    #server;

    constructor ( app, options = {} ) {
        super();

        this.#app = app;
    }

    async _init ( options ) {
        var res;

        if ( super._init ) {
            res = await super._init( options );
            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    get app () {
        return this.#app;
    }

    // public
    async authenticate ( token ) {
        if ( token instanceof Auth ) return token;

        return new Auth( this );
    }

    async listen () {
        this.#server = new Server();

        this.#server.api( "/", this );

        const res = await this.#server.listen( "0.0.0.0", SERVICE_API_PORT );

        if ( !res.ok ) return res;

        this.emit( "listening" );

        return res;
    }

    publish ( name, ...args ) {
        if ( this.#server.numSubscribers( "*" ) ) {
            const msg = JSON.stringify( {
                "jsonrpc": "2.0",
                "method": "/event",
                "params": [name, ...args],
            } );

            this.#server.publish( "*", msg, false );
        }
    }

    // protected
    _onWebsocketOpen ( ws ) {
        ws.subscribe( "*" ); // all
    }

    _onRemoteEvent ( name, auth, args ) {
        this.emit( "event", name, args );
        this.emit( "event/" + name, ...args );
    }
}
