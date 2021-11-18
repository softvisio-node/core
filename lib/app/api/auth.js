import Events from "#lib/events";
import Context from "./context.js";

export default class Auth extends Events {
    #api;
    #token;
    #isRemoved; // auth objects was removed from the cache

    #userId;
    #username;
    #permissions = {};
    #gravatar;
    #avatar;

    constructor ( api, token, options ) {

        // allows unlimited listeners from websockets connections
        super( { "maxListeners": Infinity } );

        this.#api = api;
        this.#token = token;

        this.update( options );
    }

    get api () {
        return this.#api;
    }

    get isRemoved () {
        return this.#isRemoved;
    }

    // token
    get token () {
        return this.#token;
    }

    get id () {
        return this.#token?.id;
    }

    get type () {
        return this.#token?.type;
    }

    // auth
    get userId () {
        return this.#userId;
    }

    get username () {
        return this.#username;
    }

    get permissions () {
        return this.#permissions;
    }

    get isAuthenticated () {
        return !!this.#userId;
    }

    get isRoot () {
        return this.#userId && this.#api.userIsRoot( this.#userId );
    }

    get avatar () {
        if ( !this.#avatar ) {
            if ( this.#gravatar ) {
                this.#avatar = `https://s.gravatar.com/avatar/${this.#gravatar}?d=${this.#api.app.const.defaultGravatarImage}`;
            }
            else {
                this.#avatar = this.#api.app.const.defaultGravatarUrl;
            }
        }

        return this.#avatar;
    }

    // public
    toJSON () {
        if ( this.#userId ) {
            return {
                "user_id": this.#userId,
                "username": this.#username,
                "permissions": this.#permissions,
                "avatar": this.avatar,
            };
        }
        else {
            return {};
        }
    }

    update ( options = {} ) {
        this.#avatar = null;

        if ( options.userId ) {
            this.#userId = options.userId;
            this.#username = options.username;
            this.#permissions = options.permissions;
            this.#gravatar = options.gravatar;
        }
        else {
            this.#userId = null;
            this.#username = null;
            this.#permissions = {};
            this.#gravatar = null;
        }
    }

    // called from the auth cache, when auth was invalidated
    invalidate () {
        this.#userId = null;
        this.#username = null;
        this.#permissions = {};
        this.#gravatar = null;
        this.#avatar = null;
        this.#token = null;

        this.emit( "invalidate" );
    }

    // called from the auth cache, when auth was removed from the cache
    remove () {
        this.#isRemoved = true;
    }

    // called from the auth cache, when auth was cached
    cached () {
        this.#isRemoved = false;
    }

    async authenticate () {

        // re-authentication is not required
        if ( !this.#isRemoved || !this.#token ) return this;

        return this.#api.authenticate( this );
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
            else if ( permission === "guest" ) {
                if ( !this.#userId ) return true;
            }

            // user (any authenticated)
            else if ( permission === "user" ) {
                if ( this.#userId ) return true;
            }

            // root
            else if ( permission === "root" ) {
                if ( this.isRoot ) return true;
            }

            // compare
            else {
                if ( this.#permissions[permission] ) return true;
            }
        }

        return false;
    }

    async hasObjectPermissions ( objectId, permissions ) {
        if ( this.isRoot ) return true;

        return this.api.hasObjectPermissions( objectId, this.#userId, permissions );
    }

    async call ( method, ...args ) {

        // create private context
        const ctx = new Context( this, {
            "isPrivate": true,
        } );

        return ctx.call( method, ...args );
    }

    callVoid ( method, ...args ) {

        // create private context
        const ctx = new Context( this, {
            "isPrivate": true,
        } );

        ctx.callVoid( method, ...args );
    }
}
