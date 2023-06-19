export default class {
    #app;
    #id;
    #email;
    #emailConfirmed;
    #isEnabled;
    #locale;
    #avatar;
    #passwordHash;
    #notifications;
    #password;
    #localeIsSet = false;

    constructor ( app, fields ) {
        this.#app = app;

        if ( fields ) {
            this.#id = fields.id;

            this.update( fields );
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

    get localeIsSet () {
        return this.#localeIsSet;
    }

    // public
    update ( fields ) {
        if ( "email" in fields ) this.#email = fields.email;

        if ( "email_confirmed" in fields ) this.#emailConfirmed = fields.email_confirmed;

        if ( "enabled" in fields ) this.#isEnabled = fields.enabled;

        if ( "locale" in fields ) {
            if ( this.app.locales.isLocaleValid( fields.locale ) ) {
                this.#locale = fields.locale;
                this.#localeIsSet = true;
            }
            else {
                this.#locale = this.app.locales.defaultLocale;
                this.#localeIsSet = false;
            }
        }

        if ( "gravatar" in fields ) this.#avatar = `https://s.gravatar.com/avatar/${fields.gravatar}?d=${this.app.users.config.defaultGravatarEncoded}`;

        if ( "notifications" in fields ) this.#notifications = fields.notifications;

        if ( "password_hash" in fields ) {
            this.#passwordHash = fields.password_hash;

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
