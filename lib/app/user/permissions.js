import constants from "#lib/app/constants";
import BtowserPermissions from "#lib/_browser/app/user/permissions";
import crypto from "node:crypto";

export default class Permissions extends BtowserPermissions {
    #hash;

    // static
    static get guestsPermissions () {
        return GUESTS_PERMISSIONS;
    }

    static get rootPermissions () {
        return ROOT_PERMISSIONS;
    }

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

const GUESTS_PERMISSIONS = new Permissions(),
    ROOT_PERMISSIONS = new Permissions( constants.rootUserId );
