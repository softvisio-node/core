export default class User {
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
    #emailIsLocal;

    constructor ( app, fields ) {
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

    get isRoot () {
        return this.app.userIsRoot( this.#id );
    }

    get emailIsLocal () {
        this.#emailIsLocal ??= this.app.emailIsLocal( this.#email );

        return this.#emailIsLocal;
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

        const res = await this.app.passwordHash.verifyHash( this.#passwordHash, password );
        if ( res.ok ) {
            this.#password = password;

            return true;
        }
        else {
            return false;
        }
    }

    async apiCall ( method, ...args ) {
        return this.#call( method, args, false );
    }

    apiVoidCall ( method, ...args ) {
        this.#call( method, args, true );
    }

    // private
    async #call ( method, args, isVoid ) {
        if ( !this.app.api ) return result( [ 500, "API not available" ] );

        if ( typeof method === "object" ) {
            var signal;

            ( { method, args, signal } = method );
        }

        if ( isVoid ) {
            this.app.api.voidCall( {
                method,
                args,
                "user": this,
                signal,
            } );
        }
        else {
            return this.app.api.call( {
                method,
                args,
                "user": this,
                signal,
            } );
        }
    }
}
