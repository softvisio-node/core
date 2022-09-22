import mixins from "#lib/mixins";
import Auth from "#lib/app/api/auth";
import Token from "#lib/app/api/auth/token";
import Signal from "#lib/threads/signal";
import constants from "#lib/app/constants";
import * as validate from "#lib/utils/validate";

import LocalMixin from "#lib/app/api/local";
import ConnectionsMixin from "#lib/app/api/mixins/connections";
import AuthCacheMixin from "#lib/app/api/mixins/auth-cache";

export default class API extends mixins( LocalMixin, AuthCacheMixin, ConnectionsMixin ) {
    #app;
    #startedAuth = {};

    constructor ( app, backend, options = {} ) {
        super( backend );

        this.#app = app;
    }

    // properties
    get isApi () {
        return true;
    }

    get app () {
        return this.#app;
    }

    // public
    // authentication
    async authenticate ( token ) {

        // backend is down
        if ( !this.isConnected ) return;

        var auth;

        // no token provided
        if ( !token ) return new Auth( this );

        // parse token
        token = Token.new( token );

        // token error, create invalid auth descriptor
        if ( !token ) return new Auth( this, true );

        // get auth from cache by token id or user name
        auth = this.authCache.get( token );

        // auth is cached
        if ( auth ) {

            // cached auth is match provided token
            if ( auth.token.hash === token.hash ) {
                return auth;
            }

            // cached auth is not match provided token
            else {
                return new Auth( this, token );
            }
        }

        // auth is not cached
        else {

            // authentication is already started
            if ( this.#startedAuth[token.cacheId] ) return ( this.#startedAuth[token.cacheId].signal ??= new Signal() ).wait();

            // start suthentication
            this.#startedAuth[token.cacheId] = {};

            // perform authentication on backend
            const userData = await super.authenticate( token );

            // authenticated
            if ( userData ) {
                auth = new Auth( this, token, userData );

                // add to the cache, if authenticated
                this.authCache.add( auth );
            }

            // not authenticated
            else {
                auth = new Auth( this, token );
            }

            const signal = this.#startedAuth[token.cacheId].signal;

            delete this.#startedAuth[token.cacheId];

            if ( signal ) signal.broadcast( auth );

            return auth;
        }
    }

    // validators
    userIsRoot ( userId ) {
        return userId + "" === constants.rootUserId;
    }

    validatePassword ( value ) {
        return validate.validatePassword( value, { "strength": this.app.config.passwordsStrength } );
    }

    validateTelegramUsername ( value ) {
        return validate.validateTelegramUsername( value );
    }

    validateEmail ( value ) {
        return validate.validateEmail( value );
    }

    // protected
    async _init ( options = {} ) {
        var res;

        if ( super._init ) {
            res = await super._init( options );
            if ( !res.ok ) return res;
        }

        return result( 200 );
    }
}
