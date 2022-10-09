import User from "#lib/app/api/auth/user";

export default class Auth {
    #api;
    #user;
    #token;

    constructor ( api, token, user ) {
        this.#api = api;
        this.#user = new User( user );
        this.#token = token;
    }

    // properties
    get api () {
        return this.#api;
    }

    get user () {
        return this.#user;
    }

    get token () {
        return this.#token;
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
