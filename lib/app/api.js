import mixins from "#lib/mixins";
import Auth from "./api/auth.js";
import Token from "./api/auth/token.js";
import crypto from "crypto";
import Events from "#lib/events";

import LocalMixin from "./api/local.js";
import ConnectionMixin from "./api/mixins/connection.js";
import AuthCacheMixin from "./api/mixins/auth-cache.js";

import CONST from "#lib/const";

export default class API extends mixins( AuthCacheMixin, LocalMixin, ConnectionMixin, Events ) {
    usernameIsEmail = true;
    newUserEnabled = true;
    defaultGravatarEmail = "noname@softvisio.net"; // used, if user email is not set
    defaultGravatarImage = "identicon"; // url encoded url, 404, mp, identicon, monsterid, wavatar, retro, robohash, blank

    defaultGravatarUrl;

    #app;

    constructor ( app, backend, options = {} ) {
        super( backend );

        if ( typeof options.usernameIsEmail === "boolean" ) this.usernameIsEmail = options.usernameIsEmail;
        if ( typeof options.newUserEnabled === "boolean" ) this.newUserEnabled = options.newUserEnabled;
        if ( options.defaultGravatarEmail ) this.defaultGravatarEmail = options.defaultGravatarEmail;
        if ( options.defaultGravatarImage ) this.defaultGravatarImage = options.defaultGravatarImage;

        this.defaultGravatarUrl = `https://s.gravatar.com/avatar/${crypto.createHash( "MD5" ).update( this.defaultGravatarEmail.toLowerCase() ).digest( "hex" )}?d=${this.defaultGravatarImage}`;

        this.#app = app;
    }

    async _init ( options = {} ) {
        var res;

        if ( super._init ) {
            res = await super._init( options );
            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    // props
    get app () {
        return this.#app;
    }

    // public
    // authentication
    // XXX mutex
    async authenticate ( token ) {
        var auth;

        // no token provided
        if ( !token ) return new Auth( this );

        // auth
        if ( token instanceof Auth ) {
            auth = token;

            // auth has no token, unable to authenticate
            if ( !auth.token ) return auth;
        }

        // token
        else {

            // parse token
            token = Token.new( token );

            // token parse error
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
                auth = new Auth( this, token );
            }
        }

        auth.update( await super.authenticate( auth.token ) );

        // put to the cache, if authenticated
        if ( auth.isAuthenticated ) this.authCache.set( token, auth );

        return auth;
    }

    // validators
    userIsRoot ( userId ) {
        return userId + "" === CONST.ROOT_USER_ID || userId === CONST.ROOT_USER_NAME;
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
}
