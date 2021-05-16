import "#index";

import argon2 from "@softvisio/argon2";

const DEFAULT_TYPE = argon2.argon2id;
const DEFAULT_HASH_LENGTH = 32;
const DEFAULT_TIME_COST = 3;
const DEFAULT_MEMORY_COST = 4096;
const DEFAULT_PARALLELISM = 1;
const DEFAULT_SALT_LENGTH = 16;

export default class {
    #params;

    static async new ( options ) {
        const worker = new this( options );

        return worker;
    }

    constructor ( options = {} ) {
        this.#params = {
            "type": options.type || DEFAULT_TYPE,
            "hashLength": options.hashLength || DEFAULT_HASH_LENGTH,
            "timeCost": options.timeCost || DEFAULT_TIME_COST,
            "memoryCost": options.memoryCost || DEFAULT_MEMORY_COST,
            "parallelism": options.parallelism || DEFAULT_PARALLELISM,
            "saltLength": options.saltLength || DEFAULT_SALT_LENGTH,
        };
    }

    async API_hash ( password ) {
        const hash = await argon2.hash( password, this.#params );

        return result( 200, hash );
    }

    async API_verify ( hash, password ) {
        if ( await argon2.verify( hash, password ) ) {
            return result( 200 );
        }
        else {
            return result( [404, "Password is invalid"] );
        }
    }
}
