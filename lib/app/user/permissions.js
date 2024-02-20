import Permissions from "#lib/_browser/app/user/permissions";
import crypto from "node:crypto";

export default class extends Permissions {
    #hash;

    // properties
    get hash () {
        if ( !this.isAuthenticated ) {
            return "0";
        }
        else if ( this.isRoot ) {
            return "-1";
        }
        else {
            this.#hash ??= crypto
                .createHash( "md5" )
                .update( JSON.stringify( [ this.userId, this.isMember, ...this ].sort() ) )
                .digest( "hex" );

            return this.#hash;
        }
    }
}
