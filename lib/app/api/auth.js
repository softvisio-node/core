import Token from "#lib/app/api/token";
import User from "#lib/app/api/user";

export default class Auth {
    #api;
    #token;
    #user;

    constructor ( api, token, user ) {
        this.#api = api;
        this.#token = token || new Token();
        this.#user = new User( api, user );
    }

    // properties
    get api () {
        return this.#api;
    }

    get token () {
        return this.#token;
    }

    get user () {
        return this.#user;
    }

    get isAuthenticated () {
        return !!this.#user.id;
    }

    get isValid () {

        // no token
        if ( this.#token.type == null ) return true;

        // token is corrupted
        if ( !this.#token.isValid ) return false;

        // token is not associated with user
        if ( !this.#user.id ) return false;

        return true;
    }

    // public
    toJSON () {
        return this.#user.toJSON();
    }
}
