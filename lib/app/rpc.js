import mixins from "#core/mixins";
import Server from "#lib/server";
import Events from "#core/events";

import Auth from "#lib/api/auth";

import HealthCheckMixin from "#lib/api/local/health-check";
import APISchemaMixin from "#lib/api/local/schema";
import ConnectionMixin from "#lib/api/mixins/connection";

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
        return super.publish( ["*"], name, ...args );
    }

    // protected
    _onRemoteEvent ( name, auth, args ) {
        this.emit( "event", name, args );
        this.emit( "event/" + name, ...args );
    }
}
