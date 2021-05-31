import mixins from "#lib/mixins";

import Auth from "./auth.js";

import HealthCheckMixin from "./local/health-check.js";
import APISchemaMixin from "./local/schema.js";
import ConnectionMixin from "./mixins/connection.js";

export default class RPC extends mixins( HealthCheckMixin, APISchemaMixin, ConnectionMixin ) {
    #app;

    static async new ( app, options = {} ) {
        const rpc = new this( app, options );

        // init api
        const res = await rpc._init( options );

        if ( !res.ok ) {
            console.log( "TERMINATED" );

            return;
        }

        return rpc;
    }

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

    // protected
    // XXX
    _onWebsocketOpen ( ws ) {
        ws.subscribe( ":rpc:*" ); // all
    }

    // XXX
    async _onWebsocketEvent ( ws, msg ) {}
}
