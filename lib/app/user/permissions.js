import crypto from "node:crypto";
import BtowserPermissions from "#lib/_browser/app/user/permissions";

export default class Permissions extends BtowserPermissions {
    #hash;

    // properties
    get hash () {
        if ( !this.#hash ) {
            if ( this.isGuest ) {
                this.#hash = "0";
            }
            else if ( this.isRoot ) {
                this.#hash = "-1";
            }
            else {
                this.#hash = crypto
                    .createHash( "MD5" )
                    .update( JSON.stringify( [ this.userId, this.isMember, ...this ].sort() ) )
                    .digest( "hex" );
            }
        }

        return this.#hash;
    }
}
