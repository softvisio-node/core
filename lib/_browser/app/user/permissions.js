import constants from "../constants.js";

export default class {
    #userId;
    #permissions;
    #root;

    constructor ( userId, permissions ) {
        this.#userId = userId ? userId + "" : null;

        if ( !userId || this.isRoot ) {
            this.#permissions = new Set();
        }
        else {
            this.#permissions = new Set( permissions );
        }
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

    // public
    addAclPermissions ( permissions ) {
        if ( !this.#userId || this.isRoot ) {
            return this;
        }
        else if ( !permissions?.length ) {
            return new this.constructor( this.#userId, [ ...this ], { "member": true } );
        }
        else {
            return new this.constructor( this.#userId, [ ...this, ...permissions ], { "member": true } );
        }
    }

    setAclPermissions ( permissions ) {
        if ( !this.#userId || this.isRoot ) {
            return this;
        }
        else if ( !permissions?.length ) {
            return new this.constructor( this.#userId, null, { "member": true } );
        }
        else {
            return new this.constructor( this.#userId, [ ...permissions ], { "member": true } );
        }
    }

    has ( permissions ) {
        if ( !Array.isArray( permissions ) ) permissions = [ permissions ];

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
