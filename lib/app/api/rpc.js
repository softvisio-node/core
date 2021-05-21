import mixins from "#lib/mixins";

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
    async call ( methodId, ...args ) {
        var methodSpec = this.schema.getMethod( methodId );

        if ( !methodSpec ) return result( [404, "Method not found"] );

        var res;

        // validate method params
        res = this.schema.validateMethodParams( methodSpec, args );

        if ( !res.ok ) return res;

        // call method
        try {
            res = result.tryResult( await methodSpec.object[methodSpec.name]( this, ...args ) );
        }
        catch ( e ) {
            res = result.catchResult( e );
        }

        return res;
    }

    async callVoid ( methodId, ...args ) {
        var methodSpec = this.schema.getMethod( methodId );

        if ( !methodSpec ) return result( [404, "Method not found"] );

        // validate method params
        if ( !this.schema.validateMethodParams( methodSpec, args ) ) return;

        // call method
        try {
            await methodSpec.object[methodSpec.name]( this, ...args );
        }
        catch ( e ) {}
    }

    // protected
    _onWebsocketOpen ( ws ) {
        ws.subscribe( ":rpc:*" ); // all
    }

    async _onWebsocketEvent ( ws, msg ) {}

    async _authenticateConnection ( token ) {
        return this;
    }

    _connectionHasPermissions ( auth, permissions ) {
        return true;
    }
}
