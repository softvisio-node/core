import crypto from "crypto";

const HASH_ALGORITHM = "sha3-512";

export default class Resource {

    // public
    isExists ( location ) {
        return false;
    }

    // protected
    _getHash () {
        return crypto.createHash( HASH_ALGORITHM );
    }
}
