export default class {
    #app;
    #api; // XXX
    #id;
    #email;
    #emailConfirmed;
    #isEnabled;
    #locale;
    #avatar;
    #passwordHash;
    #notifications;
    #password;

    constructor ( app, data ) {
        this.#app = app;
        this.#api = app.api;

        if ( data ) {
            this.#id = data.id;

            this.update( data );
        }
    }

    // properties
    get app () {
        return this.#app;
    }

    get id () {
        return this.#id;
    }

    get email () {
        return this.#email;
    }

    get emailConfirmed () {
        return this.#emailConfirmed;
    }

    get isEnabled () {
        return this.#isEnabled;
    }

    get locale () {
        return this.#locale;
    }

    get avatar () {
        return this.#avatar;
    }

    get notifications () {
        return this.#notifications;
    }

    get isAuthenticated () {
        return !!this.#id;
    }

    get isRoot () {
        return this.app.userIsRoot( this.#id );
    }

    // public
    update ( data ) {
        if ( "email" in data ) this.#email = data.email;
        if ( "email_confirmed" in data ) this.#emailConfirmed = data.email_confirmed;
        if ( "enabled" in data ) this.#isEnabled = data.enabled;

        if ( "locale" in data ) {
            if ( !data.locale ) {
                this.#locale = this.#api.config.defaultLocale;
            }
            else if ( !this.#api.config.locales.includes( data.locale ) ) {
                this.#locale = this.#api.config.defaultLocale;
            }
            else {
                this.#locale = data.locale;
            }
        }

        if ( "gravatar" in data ) this.#avatar = `https://s.gravatar.com/avatar/${data.gravatar}?d=${this.#api.config.defaultGravatarEncoded}`;

        if ( "notifications" in data ) this.#notifications = data.notifications;

        if ( "password_hash" in data ) {
            this.#passwordHash = data.password_hash;

            this.#password = null;
        }
    }

    toJSON () {
        if ( this.#id ) {
            return {
                "id": this.#id,
                "email": this.#email,
                "locale": this.#locale,
                "avatar": this.#avatar,
            };
        }
        else {
            return null;
        }
    }

    async verifyPassword ( password ) {
        if ( !password || !this.#passwordHash ) return false;

        if ( password === this.#password ) return true;

        if ( await this.app.argon2.verifyHash( this.#passwordHash, password ) ) {
            this.#password = password;

            return true;
        }
        else {
            return false;
        }
    }
}
