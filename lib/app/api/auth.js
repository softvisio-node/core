import "#index";

import Events from "events";
import Context from "./context.js";

import CONST from "#lib/const";

export default class Auth extends Events {
    #api;
    #token;

    #isAuthenticated;
    #userId;
    #username;
    #permissions;
    #gravatar;
    #avatar;

    constructor ( api, token, options ) {
        super();

        this.#api = api;
        this.#token = token;

        if ( options ) {
            this.#isAuthenticated = true;

            this.#userId = options.userId;
            this.#username = options.username;
            this.#permissions = options.permissions;
            this.#gravatar = options.gravatar;
        }
        else {
            this.#isAuthenticated = false;

            this.#userId = CONST.GUEST_USER_ID;
            this.#username = null;
            this.#permissions = {};
        }
    }

    get api () {
        return this.#api;
    }

    // token
    get id () {
        return this.#token?.id;
    }

    get type () {
        return this.#token?.type;
    }

    // auth
    get isAuthenticated () {
        return this.#isAuthenticated;
    }

    get userId () {
        return this.#userId;
    }

    get username () {
        return this.#username;
    }

    get permissions () {
        return this.#permissions;
    }

    get isRoot () {
        return this.#isAuthenticated && this.#api.userIsRoot( this.#userId );
    }

    get avatar () {
        if ( !this.#avatar ) {
            if ( this.#gravatar ) {
                this.#avatar = `https://s.gravatar.com/avatar/${this.#gravatar}?d=${this.#api.defaultGravatarImage}`;
            }
            else {
                this.#avatar = this.#api.defaultGravatarUrl;
            }
        }

        return this.#avatar;
    }

    // public
    toJSON () {
        if ( this.#isAuthenticated ) {
            return {
                "is_authenticated": true,
                "user_id": this.#userId,
                "username": this.#username,
                "permissions": this.#permissions,
                "avatar": this.avatar,
            };
        }
        else {
            return {
                "isAuthenticated": false,
            };
        }
    }

    invalidate () {
        this.#isAuthenticated = false;
        this.#userId = CONST.GUEST_USER_ID;
        this.#username = null;
        this.#permissions = {};
        this.#gravatar = null;
        this.#avatar = null;
        this.#token = null;

        this.emit( "invalidate" );
    }

    compareToken ( token ) {
        return token.hash === this.#token?.hash;
    }

    hasPermissions ( permissions ) {

        // method has no permissions
        if ( !permissions ) return false;

        if ( !Array.isArray( permissions ) ) permissions = [permissions];

        // nothing to check
        if ( !permissions.length ) return false;

        for ( const permission of permissions ) {

            // any
            if ( permission === "*" ) return true;

            // guest (not authenticated)
            if ( permission === "guest" && !this.#isAuthenticated ) return true;

            // user (any authenticated)
            if ( permission === "user" && this.#isAuthenticated ) return true;

            // root
            if ( permission === "root" && this.isRoot ) return true;

            // compare
            if ( this.#permissions[permission] ) return true;
        }

        return false;
    }

    async hasObjectPermissions ( objectId, permissions ) {
        if ( this.isRoot ) return true;

        return this.api.hasObjectPermissions( objectId, this.#userId, permissions );
    }

    async call ( method, ...args ) {
        const ctx = new Context( this );

        return ctx.call( method, ...args );
    }

    async callVoid ( method, ...args ) {
        const ctx = new Context( this );

        ctx.callVoid( method, ...args );
    }
}
