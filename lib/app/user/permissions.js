import crypto from "node:crypto";

export default class {
    #permissions;
    #hash;

    constructor ( permissions ) {
        this.#permissions = new Set( permissions );
    }

    // properties
    get hash () {
        this.#hash ??= crypto
            .createHash( "md5" )
            .update( JSON.stringify( [ ...this.#permissions ].sort() ) )
            .digest( "hex" );

        return this.#hash;
    }

    // public
    has ( permissions ) {
        if ( Array.isArray( permissions ) ) {
            for ( const permission of permissions ) {
                if ( this.#permissions.has( permission ) ) return true;
            }
        }
        else if ( this.#permissions.has( permissions ) ) {
            return true;
        }

        return false;
    }

    hasAll ( permissions ) {
        for ( const permission of permissions ) {
            if ( !this.#permissions.has( permission ) ) return false;
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
