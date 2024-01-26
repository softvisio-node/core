import Permissions from "#lib/_browser/app/user/permissions";
import crypto from "node:crypto";

export default class extends Permissions {
    #hash;

    // properties
    get hash () {
        this.#hash ??= crypto
            .createHash( "md5" )
            .update( JSON.stringify( [ this.userId, ...this ].sort() ) )
            .digest( "hex" );

        return this.#hash;
    }
}
