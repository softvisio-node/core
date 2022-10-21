export default class {
    #api;
    #id;
    #email;
    #enabled;
    #locale;
    #avatar;
    #telegramUsername;
    #passwordHash;
    #notifications;
    #password;

    // XXX remove
    #roles;

    // XXX roles
    constructor ( api, data ) {
        this.#api = api;

        if ( data ) {
            this.#id = data.id;

            this.update( data );

            this.#roles = new Set();
        }
        else {
            this.#roles = new Set();
        }
    }

    // properties
    get id () {
        return this.#id;
    }

    get email () {
        return this.#email;
    }

    get enabled () {
        return this.#enabled;
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

    get notifications () {
        return this.#notifications;
    }

    // XXX remove
    get roles () {
        return this.#roles;
    }

    get isRoot () {
        return this.#id && this.#api.validate.userIsRoot( this.#id );
    }

    // public
    hasRoles ( roles ) {
        if ( this.isRoot ) return true;

        // method has no roles
        if ( !roles ) return false;

        if ( !Array.isArray( roles ) ) roles = [roles];

        // nothing to check
        if ( !roles.length ) return false;

        for ( const role of roles ) {

            // any
            if ( role === "*" ) return true;

            // guest (not authenticated)
            else if ( role === "guest" ) {
                if ( !this.#id ) return true;
            }

            // user (any authenticated)
            else if ( role === "user" ) {
                if ( this.#id ) return true;
            }

            // root
            else if ( role === "root" ) {
                if ( this.isRoot ) return true;
            }

            // compare
            else {
                if ( this.#roles.has( role ) ) return true;
            }
        }

        return false;
    }

    update ( data ) {
        if ( data.email ) this.#email = data.email;
        if ( data.enabled != null ) this.#enabled = data.enabled;

        this.setLocale( data.locale );

        if ( data.gravatar != null ) this.#avatar = `https://s.gravatar.com/avatar/${data.gravatar}?d=${this.#api.config.defaultGravatarEncoded}`;

        if ( data.telegram_username != null ) this.#telegramUsername = data.telegram_username;

        if ( data.password_hash != null ) {
            this.#passwordHash = data.password_hash;

            this.#password = null;
        }

        if ( data.notifications != null ) this.#notifications = data.notifications;
    }

    setLocale ( locale ) {
        if ( !locale ) {
            this.#locale = this.#api.config.defaultLocale;
        }
        else if ( !this.config.locales.includes( locale ) ) {
            this.#locale = this.#api.config.defaultLocale;
        }
        else {
            this.#locale = locale;
        }
    }

    // XXX roles
    toJSON () {
        if ( this.#id ) {
            return {
                "user_id": this.#id,
                "email": this.#email,
                "locale": this.#locale,
                "avatar": this.#avatar,
                "roles": this.#roles.size ? [...this.#roles] : null,
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
