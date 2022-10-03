import mixins from "#lib/mixins";

import Auth from "#lib/app/api/auth";

import HealthCheckMixin from "#lib/app/api/local/health-check";
import ApiSchemaMixin from "#lib/app/api/local/schema";
import ConnectionsMixin from "#lib/app/api/mixins/connections";

export default class RPC extends mixins( HealthCheckMixin, ApiSchemaMixin, ConnectionsMixin ) {
    #app;
    #config;

    constructor ( app, config, options = {} ) {
        super();

        this.#app = app;
        this.#config = config;
    }

    // properties
    get isRpc () {
        return true;
    }

    get app () {
        return this.#app;
    }

    get config () {
        return this.#config;
    }

    // public
    async authenticate ( token ) {
        if ( token instanceof Auth ) return token;

        return new Auth( this );
    }

    // protected
    async _init ( options ) {
        var res;

        if ( super._init ) {
            res = await super._init( options );
            if ( !res.ok ) return res;
        }

        res = await this._initApiObjects();

        return res;
    }
}
