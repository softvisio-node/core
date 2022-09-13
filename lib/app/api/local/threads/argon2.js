import argon2 from "@softvisio/argon2";

const DEFAULT = "high";

// NOTE https://github.com/ranisalt/node-argon2/wiki/Options
const SETTINGS = {
    "high": { "t": 1, "p": 4, "m": 2 ** 21 },
    "low": { "t": 3, "p": 4, "m": 2 ** 16 },
};

export default class {
    #params;

    constructor ( options = {} ) {
        this.#params = {
            "type": options.type || argon2.argon2id,
            "timeCost": options.timeCost || SETTINGS[DEFAULT].t,
            "parallelism": options.parallelism || SETTINGS[DEFAULT].p,
            "memoryCost": options.memoryCost || SETTINGS[DEFAULT].m,
            "saltLength": options.saltLength || 16,
            "hashLength": options.hashLength || 32,
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
