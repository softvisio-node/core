export default class Auth {
    #api;
    #token;
    #userId;
    #email;
    #locale;
    #roles;
    #gravatar;
    #avatar;

    constructor ( api, token, userData ) {
        this.#api = api;
        this.#token = token;

        if ( userData ) {
            this.#userId = userData.userId;
            this.#email = userData.email;
            this.#gravatar = userData.gravatar;

            this.setLocale( userData.locale );

            this.#roles = new Set( Object.entries( userData.roles )
                .filter( ( [role, enabled] ) => enabled )
                .map( ( [role, enabled] ) => role ) );
        }
        else {
            this.#roles = new Set();
        }
    }

    // properties
    get api () {
        return this.#api;
    }

    // token
    get token () {
        return this.#token;
    }

    get id () {
        return this.#token?.id;
    }

    get type () {
        return this.#token?.type;
    }

    get isValid () {
        return !this.#token || this.#userId;
    }

    // auth
    get userId () {
        return this.#userId;
    }

    get email () {
        return this.#email;
    }

    get locale () {
        return this.#locale;
    }

    get roles () {
        return this.#roles;
    }

    get isAuthenticated () {
        return !!this.#userId;
    }

    get isRoot () {
        return this.#userId && this.#api.userIsRoot( this.#userId );
    }

    get avatar () {
        this.#avatar ||= `https://s.gravatar.com/avatar/${this.#gravatar}?d=${this.config.defaultGravatarEncoded}`;

        return this.#avatar;
    }

    // public
    toJSON () {
        if ( this.#userId ) {
            return {
                "user_id": this.#userId,
                "email": this.#email,
                "locale": this.#locale,
                "roles": this.#roles.size ? [...this.#roles] : null,
                "avatar": this.avatar,
            };
        }
        else {
            return {};
        }
    }

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
                if ( !this.#userId ) return true;
            }

            // user (any authenticated)
            else if ( role === "user" ) {
                if ( this.#userId ) return true;
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
            this.#locale = this.config.defaultLocale;
        }
        else if ( !this.config.locales.includes( locale ) ) {
            this.#locale = this.config.defaultLocale;
        }
        else {
            this.#locale = locale;
        }
    }
}
