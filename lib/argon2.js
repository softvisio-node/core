import * as argon2 from "@softvisio/argon2";

// NOTE: https://github.com/ranisalt/node-argon2/wiki/Options

const PRESETS = {
        "default": { "t": 3, "p": 4, "m": 65_536 },
    },
    DEFAULT_PRESET = "default",
    DEFAULT_TYPE = "argon2id",
    TYPES = {
        [ argon2.argon2d ]: "argon2d",
        [ argon2.argon2i ]: "argon2i",
        [ argon2.argon2id ]: "argon2id",
    };

export default class Argon2 {
    #params;

    constructor ( { preset = DEFAULT_PRESET, type, timeCost, parallelism, memoryCost, saltLength, hashLength } = {} ) {
        this.#params = {
            "type": argon2[ type ] ?? argon2[ DEFAULT_TYPE ],
            "timeCost": timeCost || PRESETS[ preset ].t,
            "parallelism": parallelism || PRESETS[ preset ].p,
            "memoryCost": memoryCost || PRESETS[ preset ].m,
            "saltLength": saltLength || 16,
            "hashLength": hashLength || 32,
        };
    }

    // properties
    get type () {
        return TYPES[ this.#params.type ];
    }

    get timeCost () {
        return this.#params.timeCost;
    }

    get parallelism () {
        return this.#params.parallelism;
    }

    get memoryCost () {
        return this.#params.memoryCost;
    }

    get saltLength () {
        return this.#params.saltLength;
    }

    get hashLength () {
        return this.#params.hashLength;
    }

    // public
    async createHash ( password ) {
        return argon2.hash( password, this.#params );
    }

    async verifyHash ( hash, password ) {
        return argon2.verify( hash, password );
    }

    needsRehash ( hash ) {
        return argon2.needsRehash( hash, this.#params );
    }
}
