import mixins from "#lib/mixins";

import HealthCheckMixin from "./api/mixins/health-check.js";
import SchemaMixin from "./api/mixins/schema.js";
import ConnectionMixin from "./api/mixins/connection.js";

export default class RPC extends mixins( HealthCheckMixin, SchemaMixin, ConnectionMixin ) {
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
        var methodSpec = this.getMethod( methodId );

        if ( !methodSpec ) return result( [404, "Method not found"] );

        var res;

        // call method
        try {
            res = result.tryResult( await methodSpec.object[methodSpec.name]( ...args ) );
        }
        catch ( e ) {
            res = result.catchResult( e );
        }

        return res;
    }

    async callVoid ( methodId, ...args ) {
        var methodSpec = this.getMethod( methodId );

        if ( !methodSpec ) return result( [404, "Method not found"] );

        // call method
        try {
            await methodSpec.object[methodSpec.name]( ...args );
        }
        catch ( e ) {}
    }

    authenticate () {
        return this;
    }

    hasPermissions ( permissions ) {
        return true;
    }

    // protected
    _validateSchemaPermissions ( permissions ) {
        return result( 200 );
    }

    _onWebsocketAuth ( ws ) {
        ws.subscribe( ":rpc:*" ); // all
    }

    async _onWebsocketEvent ( ws, msg ) {}
}
