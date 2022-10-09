import Token from "#lib/app/api/auth/token";
import User from "#lib/app/api/auth/user";

export default class Auth {
    #api;
    #token;
    #user;

    constructor ( api, token, user ) {
        this.#api = api;
        this.#token = token || new Token();
        this.#user = new User( user );
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
        return !this.#token || this.#user.id;
    }

    // public
    toJSON () {
        if ( this.#user.id ) {
            return {
                "user_id": this.#user.id,
                "email": this.#user.email,
                "locale": this.#user.locale,
                "avatar": this.#user.avatar,
                "roles": this.#user.roles.size ? [...this.#user.roles] : null,
            };
        }
        else {
            return {};
        }
    }
}
