export default class {
    #userId;
    #permissions;
    #root;

    constructor ( userId, permissions ) {
        this.#userId = userId ? userId + "" : null;

        this.#permissions = new Set( userId ? permissions : null );
    }

    // properties
    get userId () {
        return this.#userId;
    }

    get isAuthenticated () {
        return !!this.#userId;
    }

    get isRoot () {
        return this.#userId === "-1";
    }

    // public
    add ( permissions ) {
        if ( !permissions ) return this;

        return new this.constructor( this.#userId, [ ...this, ...permissions ] );
    }

    has ( permissions ) {
        if ( this.isRoot ) return true;

        if ( !Array.isArray( permissions ) ) permissions = [ permissions ];

        for ( const permission of permissions ) {
            if ( permission === "guests" ) {
                if ( !this.isAuthenticated ) return true;
            }
            else if ( permission === "users" ) {
                if ( this.isAuthenticated ) return true;
            }
            else if ( permission === "root" ) {
                if ( this.isRoot ) return true;
            }
            else if ( this.#permissions.has( permission ) ) {
                return true;
            }
        }

        return false;
    }

    hasAll ( permissions ) {
        if ( this.isRoot ) return true;

        for ( const permission of permissions ) {
            if ( !this.#permissions.has( [ permission ] ) ) return false;
        }

        return true;
    }

    toJSON () {
        return [ ...this.#permissions ];
    }

    [ Symbol.iterator ] () {
        return this.#permissions.values();
    }
}
