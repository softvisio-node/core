import argon2 from "@softvisio/argon2";

// NOTE https://github.com/ranisalt/node-argon2/wiki/Options
// t=1, p=4, m=2^21 (2 GiB) - high RAM
// t=3, p=4, m=2^16 (64 MiB) - low RAM

const DEFAULT_TYPE = argon2.argon2id;
const DEFAULT_TIME_COST = 3; // t
const DEFAULT_PARALLELISM = 4; // p
const DEFAULT_MEMORY_COST = 65536; // m, in KB, 64 MB
const DEFAULT_SALT_LENGTH = 16;
const DEFAULT_HASH_LENGTH = 32;

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
            return result( 401 );
        }
    }
}
