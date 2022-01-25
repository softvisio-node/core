import mixins from "#lib/mixins";
import Auth from "#lib/app/api/auth";
import Token from "#lib/app/api/auth/token";
import Signal from "#lib/threads/signal";
import constants from "#lib/app/constants";

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
        if ( !this.isConnected ) return;

        var auth;

        // no token provided
        if ( !token ) return new Auth( this );

        // parse token
        token = Token.new( token );

        // token error
        if ( !token ) return new Auth( this );

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
            let signal;

            // authentication is already started
            if ( this.#startedAuth[token.cacheId] ) return ( signal = new Signal() ).wait();

            // start suthentication
            this.#startedAuth[token.cacheId] = true;

            auth = new Auth( this, token, await super.authenticate( token ) );

            // put to the cache, if authenticated
            if ( auth.isAuthenticated ) this.authCache.set( token, auth );

            delete this.#startedAuth[token.cacheId];
            if ( signal ) signal.broadcast( auth );

            return auth;
        }
    }

    // validators
    userIsRoot ( userId ) {
        return userId + "" === constants.rootUserId || userId === constants.rootUsername;
    }

    validatePassword ( password ) {
        if ( password.length < 1 ) return result( [400, "Password must contain at least 1 character"] );

        return result( 200 );
    }

    // accepted characters: A-z (case-insensitive), 0-9, "_", "-", "@", ".", length: 3-32 characters, not number, not UUID
    validateUsername ( username ) {

        // check length
        if ( username.length < 3 || username.length > 32 ) return result( [400, "User name length must be between 3 and 32 characters"] );

        // contains forbidden chars
        if ( /[^a-z\d_@.-]/i.test( username ) ) return result( [400, `User name must contain letters, digits, "_", "@", ".", "-" characters only`] );

        // number
        if ( !isNaN( username ) ) return result( [400, "User name should not be a number"] );

        // looks like uuid
        if ( /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test( username ) ) return result( [400, "User name should not look like UUID"] );

        return result( 200 );
    }

    // accepted characters: A-z (case-insensitive), 0-9 and underscores, length: 5-255 characters
    validateTelegramUsername ( username ) {

        // check length
        if ( username.length < 5 || username.length > 255 ) return result( [400, "Telegram user name length must be between 5 and 32 characters"] );

        // contains forbidden chars
        if ( /[^a-z\d_]/i.test( username ) ) return result( [400, `Telegram user name must contain letters, digits and "_" only`] );

        return result( 200 );
    }

    validateEmail ( email ) {
        if ( !/^[a-z\d][a-z\d._-]*[a-z\d]@(?:[a-z\d][a-z\d-]*.)+[a-z\d][a-z\d-]*[a-z\d]$/i.test( email ) ) return result( [400, "Email is invalid"] );

        return result( 200 );
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
