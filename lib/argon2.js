import * as argon2 from "@softvisio/argon2";

// NOTE https://github.com/ranisalt/node-argon2/wiki/Options
const PRESETS = {
    "default": { "t": 3, "p": 4, "m": 65_536 },
};

const DEFAULT_PRESET = "default";

export default class Argon2 {
    #params;

    constructor ( { preset = DEFAULT_PRESET, type, timeCost, parallelism, memoryCost, saltLength, hashLength } = {} ) {
        this.#params = {
            "type": argon2[ type ] ?? argon2.argon2id,
            "timeCost": timeCost || PRESETS[ preset ].t,
            "parallelism": parallelism || PRESETS[ preset ].p,
            "memoryCost": memoryCost || PRESETS[ preset ].m,
            "saltLength": saltLength || 16,
            "hashLength": hashLength || 32,
        };
    }

    // public
    async createHash ( password ) {
        return argon2.hash( password, this.#params );
    }

    async verifyHash ( hash, password ) {
        return argon2.verify( hash, password );
    }
}
