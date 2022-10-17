export default class {
    #auth;
    #id;
    #email;
    #locale;
    #avatar;
    #roles;

    constructor ( auth, user ) {
        this.#auth = auth;

        if ( user ) {
            this.#id = user.id;
            this.#email = user.email;
            this.#avatar = `https://s.gravatar.com/avatar/${user.gravatar}?d=${this.#auth.api.config.defaultGravatarEncoded}`;

            this.setLocale( user.locale );

            this.#roles = new Set( Object.entries( user.roles )
                .filter( ( [role, enabled] ) => enabled )
                .map( ( [role, enabled] ) => role ) );
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

    get locale () {
        return this.#locale;
    }

    get avatar () {
        return this.#avatar;
    }

    get roles () {
        return this.#roles;
    }

    get isRoot () {
        return this.#id && this.#auth.api.validate.userIsRoot( this.#id );
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

    setLocale ( locale ) {
        if ( !locale ) {
            this.#locale = this.#auth.api.config.defaultLocale;
        }
        else if ( !this.config.locales.includes( locale ) ) {
            this.#locale = this.#auth.api.config.defaultLocale;
        }
        else {
            this.#locale = locale;
        }
    }

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
}
