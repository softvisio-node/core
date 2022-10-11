import "#lib/result";
import argon2 from "@softvisio/argon2";

// NOTE https://github.com/ranisalt/node-argon2/wiki/Options
const PRESETS = {
    "default": { "t": 3, "p": 1, "m": 4096 },
    "recommended": { "t": 3, "p": 4, "m": 2 ** 16 },
};

const DEFAULT_PRESET = "default";

export default class {
    #params;

    constructor ( { preset = DEFAULT_PRESET, type, timeCost, parallelism, memoryCost, saltLength, hashLength } = {} ) {
        this.#params = {
            "type": type || argon2.argon2id,
            "timeCost": timeCost || PRESETS[preset].t,
            "parallelism": parallelism || PRESETS[preset].p,
            "memoryCost": memoryCost || PRESETS[preset].m,
            "saltLength": saltLength || 16,
            "hashLength": hashLength || 32,
        };
    }

    // public
    async createHash ( password ) {
        const hash = await argon2.hash( password, this.#params );

        return result( 200, hash );
    }

    async verifyHash ( hash, password ) {
        if ( await argon2.verify( hash, password ) ) {
            return result( 200 );
        }
        else {
            return result( 401 );
        }
    }
}
