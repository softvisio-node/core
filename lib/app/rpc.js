import mixins from "#lib/mixins";
import Server from "#lib/app/server";
import Events from "#lib/events";

import Auth from "#lib/app/api/auth";

import HealthCheckMixin from "#lib/app/api/local/health-check";
import ApiSchemaMixin from "#lib/app/api/local/schema";
import ConnectionMixin from "#lib/app/api/mixins/connection";

const SERVICE_API_PORT = 8080;

export default class RPC extends mixins( HealthCheckMixin, ApiSchemaMixin, ConnectionMixin, Events ) {
    #app;
    #server;

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

    async listen () {
        this.#server = new Server();

        this.#server.api( "/", this );

        const res = await this.#server.listen( "0.0.0.0", SERVICE_API_PORT );

        if ( !res.ok ) return res;

        this.emit( "listening" );

        return res;
    }

    // protected
    async _init ( options ) {
        var res;

        if ( super._init ) {
            res = await super._init( options );
            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    _onRemoteEvent ( name, auth, args ) {
        this.emit( "event", name, args );
        this.emit( "event/" + name, ...args );
    }
}
