import Events from "#lib/events";

export default class User extends Events {
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

    constructor ( app, fields ) {
        super();

        this.#app = app;

        if ( fields ) {
            this.#id = fields.id;

            this.updateFields( fields );
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
        this.#avatar ??= this.app.api?.avatarUrl + "?id=" + this.#id;

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
    updateFields ( fields ) {
        if ( "email" in fields ) this.#email = fields.email;

        if ( "email_confirmed" in fields ) this.#emailConfirmed = fields.email_confirmed;

        if ( "enabled" in fields ) this.#isEnabled = fields.enabled;

        if ( "locale" in fields ) {
            const oldLocale = this.#locale;

            this.#locale = this.app.locales.find( { "locale": fields.locale } );

            if ( oldLocale !== this.#locale ) this.emit( "localeChange" );
        }

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
                "avatar": this.avatar,
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
