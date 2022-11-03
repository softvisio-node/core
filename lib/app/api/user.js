export default class {
    #api;
    #id;
    #email;
    #emailConfirmed;
    #isEnabled;
    #locale;
    #avatar;
    #telegramUsername;
    #telegramUserId;
    #passwordHash;
    #notifications;
    #password;

    constructor ( api, data ) {
        this.#api = api;

        if ( data ) {
            this.#id = data.id;

            this.update( data );
        }
    }

    // properties
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

    get telegramUsername () {
        return this.#telegramUsername;
    }

    get telegramUserId () {
        return this.#telegramUserId;
    }

    get notifications () {
        return this.#notifications;
    }

    get isRoot () {
        return this.#id && this.#api.validate.userIsRoot( this.#id );
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
        if ( "telegram_username" in data ) this.#telegramUsername = data.telegram_username;
        if ( "telegram_user_id" in data ) this.#telegramUserId = data.telegram_user_id;

        if ( "notifications" in data ) this.#notifications = data.notifications;

        if ( "password_hash" in data ) {
            this.#passwordHash = data.password_hash;

            this.#password = null;
        }
    }

    toJSON () {
        if ( this.#id ) {
            return {
                "user_id": this.#id,
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

        if ( this.#api.argon2.verifyHash( this.#passwordHash, password ) ) {
            this.#password = password;

            return true;
        }
        else {
            return false;
        }
    }
}
