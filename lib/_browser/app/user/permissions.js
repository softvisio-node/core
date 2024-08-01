import constants from "../constants.js";

var GUESTS_PERMISSIONS, ROOT_PERMISSIONS;

export default class Permissions {
    #userId;
    #permissions;

    constructor ( userId, permissions ) {
        this.#userId = userId ? userId : null;

        if ( !userId || this.isRoot ) {
            this.#permissions = new Set();
        }
        else {
            this.#permissions = new Set( permissions );
        }
    }

    // static
    static get guestsPermissions () {
        return ( GUESTS_PERMISSIONS ??= new this() );
    }

    static get rootPermissions () {
        return ( ROOT_PERMISSIONS ??= new this( constants.rootUserId ) );
    }

    // properties
    get userId () {
        return this.#userId;
    }

    get isGuest () {
        return !this.#userId;
    }

    get isRoot () {
        return this.#userId === constants.rootUserId;
    }

    get length () {
        return this.#permissions.size;
    }

    // public
    addPermissions ( permissions ) {
        if ( !this.#userId || this.isRoot || !permissions?.length ) {
            return this;
        }
        else {
            return new this.constructor( this.#userId, [ ...this, ...permissions ] );
        }
    }

    has ( permissions ) {
        if ( !Array.isArray( permissions ) ) {
            if ( !( permissions instanceof Permissions ) ) {
                permissions = [ permissions ];
            }
        }

        for ( const permission of permissions ) {
            if ( permission === "guests" ) {
                if ( this.isGuest ) return true;
            }
            else if ( !this.isGuest ) {
                if ( this.isRoot ) {
                    return true;
                }
                else if ( permission === "users" ) {
                    return true;
                }
                else if ( permission === "root" ) {
                    if ( this.isRoot ) return true;
                }
                else if ( this.#permissions.has( permission ) ) {
                    return true;
                }
            }
        }

        return false;
    }

    hasAll ( permissions ) {
        if ( !Array.isArray( permissions ) ) {
            if ( !( permissions instanceof Permissions ) ) {
                permissions = [ permissions ];
            }
        }

        for ( const permission of permissions ) {
            if ( !this.has( [ permission ] ) ) return false;
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
