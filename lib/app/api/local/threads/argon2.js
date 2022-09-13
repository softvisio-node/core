import argon2 from "@softvisio/argon2";

const DEFAULT = "high";

// NOTE https://github.com/ranisalt/node-argon2/wiki/Options
const SETTINGS = {
    "high": { "t": 1, "p": 4, "m": 2 ** 21 },
    "low": { "t": 3, "p": 4, "m": 2 ** 16 },
};

export default class {
    #params;

    constructor ( { type, timeCost, parallelism, memoryCost, saltLength, hashLength } = {} ) {
        this.#params = {
            "type": type || argon2.argon2id,
            "timeCost": timeCost || SETTINGS[DEFAULT].t,
            "parallelism": parallelism || SETTINGS[DEFAULT].p,
            "memoryCost": memoryCost || SETTINGS[DEFAULT].m,
            "saltLength": saltLength || 16,
            "hashLength": hashLength || 32,
        };
    }

    // static
    static async new ( options ) {
        const worker = new this( options );

        return worker;
    }

    // public
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
