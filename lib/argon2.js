import * as argon2 from "@softvisio/argon2";

const PRESETS = Object.freeze( {

        // DOCS: OWASP minimal settings in 2025
        // https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
        // https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#argon2id
        "owasp": {
            "id": "argon2id",
            "version": 19,
            "saltLength": 16,
            "hashLength": 32,
            "memoryCost": 1024 * 19, // 19 MiB
            "timeCost": 2,
            "parallelism": 1,
        },

        // DOCS: rfc9106 recommended settings in 2025
        // see 7.4. Recommendations
        // https://datatracker.ietf.org/doc/rfc9106/
        "rfc9106-high-memory": {
            "id": "argon2id",
            "version": 19,
            "saltLength": 16,
            "hashLength": 32,
            "memoryCost": 1024 * 1024 * 2, // 2 GiB
            "timeCost": 1,
            "parallelism": 1,
        },
        "rfc9106-low-memory": {
            "id": "argon2id",
            "version": 19,
            "saltLength": 16,
            "hashLength": 32,
            "memoryCost": 1024 * 64, // 64 MiB
            "timeCost": 3,
            "parallelism": 1,
        },
    } ),
    DEFAULT_PRESET = "owasp";

export default class Argon2 {
    #params;

    constructor ( { preset, id, version, memoryCost, timeCost, parallelism, saltLength, hashLength } = {} ) {
        preset ||= DEFAULT_PRESET;

        const defaults = PRESETS[ preset ];

        this.#params = {
            "id": id || defaults.id,
            "version": version || defaults.version,
            "memoryCost": memoryCost || defaults.memoryCost,
            "timeCost": timeCost || defaults.timeCost,
            "parallelism": parallelism || defaults.parallelism,
            "saltLength": saltLength || defaults.saltLength,
            "hashLength": hashLength || defaults.hashLength,
        };
    }

    // static
    static get presets () {
        return PRESETS;
    }

    static get defaultPreset () {
        return DEFAULT_PRESET;
    }

    // properties
    get id () {
        return this.#params.id;
    }

    get version () {
        return this.#params.version;
    }

    get memoryCost () {
        return this.#params.memoryCost;
    }

    get timeCost () {
        return this.#params.timeCost;
    }

    get parallelism () {
        return this.#params.parallelism;
    }

    get saltLength () {
        return this.#params.saltLength;
    }

    get hashLength () {
        return this.#params.hashLength;
    }

    // public
    async createHash ( password ) {
        return argon2.createHash( password, this.#params );
    }

    async verifyHash ( digest, password ) {
        return argon2.verifyHash( digest, password, this.#params );
    }

    needsRehash ( digest ) {
        return argon2.needsRehash( digest, this.#params );
    }
}
