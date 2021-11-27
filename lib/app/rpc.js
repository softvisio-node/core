import mixins from "#lib/mixins";
import Events from "#lib/events";

import Auth from "#lib/app/api/auth";

import HealthCheckMixin from "#lib/app/api/local/health-check";
import ApiSchemaMixin from "#lib/app/api/local/schema";
import ConnectionMixin from "#lib/app/api/mixins/connection";

export default class RPC extends mixins( HealthCheckMixin, ApiSchemaMixin, ConnectionMixin, Events ) {
    #app;

    constructor ( app, options = {} ) {
        super();

        this.#app = app;
    }

    // properties
    get isRpc () {
        return true;
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
    async _new ( options ) {
        var res;

        if ( super._new ) {
            res = await super._new( options );
            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    _onRemoteEvent ( name, auth, args ) {
        this.emit( "event", name, args );
        this.emit( "event/" + name, ...args );
    }
}
