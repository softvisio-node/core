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

    // protected
    _validateSchemaPermissions ( permissions ) {
        return result( 200 );
    }
}
