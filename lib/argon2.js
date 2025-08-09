import * as argon2 from "@softvisio/argon2";

// NOTE: https://github.com/ranisalt/node-argon2/wiki/Options

export default class Argon2 {
    #params;

    constructor ( { id, version, memoryCost, timeCost, parallelism, saltLength, hashLength } = {} ) {
        this.#params = {
            "id": id || argon2.DEFAULT.id,
            "version": version || argon2.DEFAULT.version,
            "memoryCost": memoryCost || argon2.DEFAULT.memoryCost,
            "timeCost": timeCost || argon2.DEFAULT.timeCost,
            "parallelism": parallelism || argon2.DEFAULT.parallelism,
            "saltLength": saltLength || argon2.DEFAULT.saltLength,
            "hashLength": hashLength || argon2.DEFAULT.hashLength,
        };
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
