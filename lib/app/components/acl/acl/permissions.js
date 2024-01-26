import crypto from "node:crypto";

export default class {
    #permissions;
    #permissionsSet;
    #hash;

    constructor ( permissions ) {
        this.#permissionsSet = new Set( permissions );

        this.#permissions = [ ...this.#permissionsSet ];
    }

    // properties
    get hash () {
        this.#hash ??= crypto.createHash( "md5" ).update( JSON.stringify( this.#permissions.sort() ) ).digest( "hex" );

        return this.#hash;
    }

    // public
    has ( permissions ) {
        if ( Array.isArray( permissions ) ) {
            for ( const permission of permissions ) {
                if ( this.#permissionsSet.has( permission ) ) return true;
            }
        }
        else if ( this.#permissionsSet.has( permissions ) ) {
            return true;
        }

        return false;
    }

    hasAll ( permissions ) {
        for ( const permission of permissions ) {
            if ( !this.#permissionsSet.has( permission ) ) return false;
        }

        return true;
    }

    toJSON () {
        return this.#permissions;
    }

    [ Symbol.iterator ] () {
        return this.#permissionsSet.values();
    }
}
