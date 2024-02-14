import constants from "../constants.js";

export default class Permissions {
    #userId;
    #permissions;
    #root;

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
        return GUESTS_PERMISSIONS;
    }

    static get rootPermissions () {
        return ROOT_PERMISSIONS;
    }

    // properties
    get userId () {
        return this.#userId;
    }

    get isAuthenticated () {
        return !!this.#userId;
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
                if ( !this.isAuthenticated ) return true;
            }
            else if ( this.isAuthenticated ) {
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

const GUESTS_PERMISSIONS = new Permissions(),
    ROOT_PERMISSIONS = new Permissions( constants.rootUserId );
