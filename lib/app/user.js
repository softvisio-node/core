import Events from "#lib/events";

export default class User extends Events {
    #app;
    #id;
    #email;
    #emailConfirmed;
    #isEnabled;
    #locale;
    #avatarUrl;
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

    get isEmailConfirmed () {
        return this.#emailConfirmed;
    }

    get isEnabled () {
        return this.#isEnabled;
    }

    get locale () {
        return this.#locale;
    }

    get avatarUrl () {
        this.#avatarUrl ??= this.app.api?.config.avatarUrl + this.#id;

        return this.#avatarUrl;
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

    get emailIsLocal () {
        return this.app.emailIsLocal( this.#email );
    }

    // public
    updateFields ( fields ) {
        if ( "email" in fields ) this.#email = fields.email;

        if ( "email_confirmed" in fields ) this.#emailConfirmed = fields.email_confirmed;

        if ( "enabled" in fields ) this.#isEnabled = fields.enabled;

        if ( "locale" in fields ) this.#locale = this.app.locales.find( { "locale": fields.locale } );

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
                "email_confirmed": this.#emailConfirmed,
                "locale": this.#locale,
                "avatar_url": this.avatarUrl,
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
