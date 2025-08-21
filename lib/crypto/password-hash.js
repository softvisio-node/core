import "#lib/result";
import crypto from "node:crypto";
import * as argon2 from "@softvisio/argon2";
import { fromPhc, toPhc } from "#lib/phc";

const DEFAULT_SALT_LENGTH = 16,
    DEFAULT_HASH_LENGTH = 16,
    ARGON2_VERSIONS = new Set( [ 16, 19 ] ),
    ALGORITHMS = {
        "argon2i": {
            "algorithm": "argon2",
            "version": 19,
            "memoryCost": 1024 * 19, // 19 MiB
            "timeCost": 2,
            "parallelism": 1,
        },
        "argon2d": {
            "algorithm": "argon2",
            "version": 19,
            "memoryCost": 1024 * 19, // 19 MiB
            "timeCost": 2,
            "parallelism": 1,
        },

        // DOCS: OWASP minimal settings in 2025
        // https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
        // https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#argon2id
        "argon2id": {
            "algorithm": "argon2",
            "version": 19,
            "memoryCost": 1024 * 19, // 19 MiB
            "timeCost": 2,
            "parallelism": 1,
        },
        "scrypt": {
            "algorithm": "scrypt",
            "cost": 2 ** 17, // 128 MiB
            "blockSize": 8, // 1024 bytes
            "parallelism": 1,
        },
        "pbkdf2-sha1": {
            "algorithm": "pbkdf2",
            "digest": "SHA1",
            "iterations": 1_300_000,
        },
        "pbkdf2-sha256": {
            "algorithm": "pbkdf2",
            "digest": "SHA256",
            "iterations": 600_000,
        },
        "pbkdf2-sha512": {
            "algorithm": "pbkdf2",
            "digest": "SHA3-512",
            "iterations": 210_000,
        },
    },
    PRESETS = Object.freeze( {
        "owasp": {
            "id": "argon2id",
        },
        "argon2": {
            "id": "argon2id",
        },
        "argon2i": {
            "id": "argon2i",
        },
        "argon2d": {
            "id": "argon2d",
        },
        "argon2id": {
            "id": "argon2id",
        },

        // DOCS: rfc-9106 recommended settings in 2025
        // https://datatracker.ietf.org/doc/html/rfc9106#name-recommendations
        "rfc-9106-high": {
            "id": "argon2id",
            "memoryCost": 1024 * 1024 * 2, // 2 GiB
            "timeCost": 1,
            "parallelism": 1,
        },
        "rfc-9106-low": {
            "id": "argon2id",
            "memoryCost": 1024 * 64, // 64 MiB
            "timeCost": 3,
            "parallelism": 1,
        },
        "scrypt": {
            "id": "scrypt",
        },
        "pbkdf2": {
            "id": "pbkdf2-sha256",
        },
        "pbkdf2-sha1": {
            "id": "pbkdf2-sha1",
        },
        "pbkdf2-sha256": {
            "id": "pbkdf2-sha256",
        },
        "pbkdf2-sha512": {
            "id": "pbkdf2-sha512",
        },
        "openssl": {
            "id": "pbkdf2-sha256",
            "iterations": 10_000,
            "saltLength": 8,
        },
    } ),
    DEFAULT_PRESET = "owasp";

export default class PasswordHash {
    #preset;
    #options;

    constructor ( { preset, version, memoryCost, timeCost, parallelism, cost, blockSize, maxMemory, iterations, saltLength, hashLength } = {} ) {
        preset ||= DEFAULT_PRESET;

        this.#preset = preset;

        const defaults = PRESETS[ this.#preset ];
        if ( !defaults ) throw new Error( "Preset value is not valid" );

        this.#options = {
            "id": defaults.id,
        };

        const algorithm = ALGORITHMS[ this.#options.id ];
        if ( !algorithm ) throw new Error( "Algorithm is not supported" );

        this.#options.algorithm = algorithm.algorithm;

        this.#options.saltLength = saltLength || defaults.saltLength || algorithm.saltLength || DEFAULT_SALT_LENGTH;
        if ( this.#options.saltLength < 8 || this.#options.saltLength > 48 ) throw "Salt length value is not valid";

        this.#options.hashLength = hashLength || defaults.hashLength || algorithm.hashLength || DEFAULT_HASH_LENGTH;
        if ( this.#options.hashLength < 12 || this.#options.hashLength > 64 ) throw "Hash length value is not valid";

        // argon2
        if ( algorithm.algorithm === "argon2" ) {
            this.#options.version = version || defaults.version || algorithm.version;
            if ( !ARGON2_VERSIONS.has( this.#options.version ) ) throw "Argon2 version is not valid";

            this.#options.memoryCost = memoryCost || defaults.memoryCost || algorithm.memoryCost;
            if ( this.#options.memoryCost < 1 || this.#options.memoryCost > 2 ** 32 - 1 ) throw "Argon2 memory cost value is not valid";

            this.#options.timeCost = timeCost || defaults.timeCost || algorithm.timeCost;
            if ( this.#options.timeCost < 1 || this.#options.timeCost > 2 ** 32 - 1 ) throw "Argon2 time cost value is not valid";

            this.#options.parallelism = parallelism || defaults.parallelism || algorithm.parallelism;
            if ( this.#options.parallelism < 1 || this.#options.parallelism > 255 ) throw "Argon2 parallelism value is not valid";
        }

        // scrypt
        else if ( algorithm.algorithm === "scrypt" ) {
            this.#options.cost = cost || defaults.cost || algorithm.cost;
            this.#options.blockSize = blockSize || defaults.blockSize || algorithm.blockSize;
            this.#options.parallelism = parallelism || defaults.parallelism || algorithm.parallelism;
            this.#options.maxMemory = maxMemory || this.constructor.calculateMaxMemory( this.#options );
        }

        // pbkdf2
        else if ( algorithm.algorithm === "pbkdf2" ) {
            this.#options.digest = algorithm.digest;
            this.#options.iterations = iterations || defaults.iterations || algorithm.iterations;
        }
    }

    // static
    static get presets () {
        return PRESETS;
    }

    static get defaultPreset () {
        return DEFAULT_PRESET;
    }

    static calculateMaxMemory ( { cost, blockSize, parallelism } ) {

        // 128 * p * r + 128 * ( 2 + N ) * r
        return 128 * parallelism * blockSize + 128 * ( 2 + cost ) * blockSize;
    }

    // properties
    get preset () {
        return this.#preset;
    }

    get algorithm () {
        return this.#options.algorithm;
    }

    get id () {
        return this.#options.id;
    }

    get version () {
        return this.#options.version;
    }

    get memoryCost () {
        return this.#options.memoryCost;
    }

    get timeCost () {
        return this.#options.timeCost;
    }

    get parallelism () {
        return this.#options.parallelism;
    }

    get cost () {
        return this.#options.cost;
    }

    get blockSize () {
        return this.#options.blockSize;
    }

    get maxMemory () {
        return this.#options.maxMemory;
    }

    get digest () {
        return this.#options.digest;
    }

    get iterations () {
        return this.#options.iterations;
    }

    get saltLength () {
        return this.#options.saltLength;
    }

    get hashLength () {
        return this.#options.hashLength;
    }

    // public
    async createPasswordHash ( password, { phc = true, salt, hashLength, keyId, data } = {} ) {
        return this.#createHash( password, {
            ...this.#options,
            phc,
            "salt": salt || ( await this.#createSalt() ),
            "hashLength": hashLength || this.#options.hashLength,
            keyId,
            data,
        } );
    }

    async verifyPasswordHash ( digest, password, { update, phc = true, keyId } = {} ) {
        try {
            if ( !( password instanceof Buffer ) ) password = Buffer.from( password );

            const parsed = fromPhc( digest );

            const algorithm = ALGORITHMS[ parsed.id ];
            if ( !algorithm ) return result( [ 500, "Algorithm is not supported" ] );

            const defaults = parsed.id === this.id
                ? this.#options
                : algorithm;

            var match = false,
                requireUpdate = parsed.id !== this.id,
                compareHash = true;

            const options = {
                "id": parsed.id,
                "phc": false,
                "salt": parsed.salt,
                "hashLength": parsed.hash.length,
            };

            // argon2
            if ( algorithm.algorithm === "argon2" ) {

                // version
                if ( !parsed.version ) {
                    options.version = defaults.version;
                    requireUpdate = true;
                }
                else if ( parsed.version === defaults.version ) {
                    options.version = parsed.version;
                }
                else {
                    requireUpdate = true;
                    compareHash = false;
                }

                // memoryCost
                if ( !parsed.params.m ) {
                    options.memoryCost = defaults.memoryCost;
                    requireUpdate = true;
                }
                else if ( parsed.params.m === defaults.memoryCost ) {
                    options.memoryCost = parsed.params.m;
                }
                else {
                    requireUpdate = true;
                    compareHash = false;
                }

                // timeCost
                if ( !parsed.params.t ) {
                    options.timeCost = defaults.timeCost;
                    requireUpdate = true;
                }
                else if ( parsed.params.t === defaults.timeCost ) {
                    options.timeCost = parsed.params.t;
                }
                else {
                    requireUpdate = true;
                    compareHash = false;
                }

                // parallelism
                if ( !parsed.params.p ) {
                    options.parallelism = defaults.parallelism;
                    requireUpdate = true;
                }
                else if ( parsed.params.p === defaults.parallelism ) {
                    options.parallelism = parsed.params.p;
                }
                else {
                    requireUpdate = true;
                    compareHash = false;
                }

                options.keyId = keyId;
                options.data = Buffer.from( parsed.params.data || "", "base64" );
            }

            // scrypt
            else if ( algorithm.algorithm === "scrypt" ) {

                // cost
                if ( !parsed.params.ln ) {
                    options.cost = defaults.cost;
                    requireUpdate = true;
                }
                else if ( parsed.params.ln === defaults.cost ) {
                    options.cost = parsed.params.ln;
                }
                else {
                    requireUpdate = true;
                    compareHash = false;
                }

                // blockSize
                if ( !parsed.params.r ) {
                    options.blockSize = defaults.blockSize;
                    requireUpdate = true;
                }
                else if ( parsed.params.r === defaults.blockSize ) {
                    options.blockSize = parsed.params.r;
                }
                else {
                    requireUpdate = true;
                    compareHash = false;
                }

                // parallelism
                if ( !parsed.params.p ) {
                    options.parallelism = defaults.parallelism;
                    requireUpdate = true;
                }
                else if ( parsed.params.p === defaults.parallelism ) {
                    options.parallelism = parsed.params.p;
                }
                else {
                    requireUpdate = true;
                    compareHash = false;
                }

                options.maxMemory = this.maxMemory || this.constructor.calculateMaxMemory( options );
            }

            // pbkdf2
            else if ( algorithm.algorithm === "pbkdf2" ) {
                options.digest = algorithm.digest;

                // iterations
                if ( !parsed.params.i ) {
                    options.iterations = defaults.iterations;
                    requireUpdate = true;
                }
                else if ( parsed.params.i === defaults.iterations ) {
                    options.iterations = parsed.params.i;
                }
                else {
                    requireUpdate = true;
                    compareHash = false;
                }
            }

            // compare hash
            if ( compareHash ) {
                const res = await this.#createHash( password, options );
                if ( !res.ok ) return res;

                match = crypto.timingSafeEqual( res.data.hash, parsed.hash );
            }

            var updatedHash;

            if ( update && requireUpdate ) {
                const res = await this.createPasswordHash( password, { phc } );
                if ( !res.ok ) return res;

                updatedHash = res.data;
            }
            else {
                updatedHash = {};
            }

            if ( match ) {
                return result( 200, {
                    requireUpdate,
                    ...updatedHash,
                } );
            }
            else {
                return result( [ 400, "Password is not valid" ], {
                    requireUpdate,
                    ...updatedHash,
                } );
            }
        }
        catch ( e ) {
            return result.catch( e );
        }
    }

    // private
    async #createSalt () {
        return new Promise( ( resolve, reject ) => {
            crypto.randomBytes( this.saltLength, ( e, buffer ) => {
                if ( e ) {
                    reject( e );
                }
                else {
                    resolve( buffer );
                }
            } );
        } );
    }

    async #createHash ( password, options ) {
        try {
            if ( !( password instanceof Buffer ) ) password = Buffer.from( password );

            const algorithm = ALGORITHMS[ options.id ].algorithm;

            let hash;

            // argon2
            if ( algorithm === "argon2" ) {
                hash = await this.#createArgon2Hash( password, options );
            }

            // scrypt
            else if ( algorithm === "scrypt" ) {
                hash = await this.#createScryptHash( password, options );
            }

            // pbkdf2
            else if ( algorithm === "pbkdf2" ) {
                hash = await this.#createPbkdf2Hash( password, options );
            }

            return result( 200, hash );
        }
        catch ( e ) {
            return result.catch( e );
        }
    }

    async #createArgon2Hash ( password, { id, phc, salt, hashLength, version, memoryCost, timeCost, parallelism, keyId, data } ) {
        keyId ||= Buffer.allocUnsafe( 0 );
        if ( !( keyId instanceof Buffer ) || keyId.length > 8 ) throw "Key id value is not valid";

        data ||= Buffer.allocUnsafe( 0 );
        if ( !( data instanceof Buffer ) || data.length > 32 ) throw "Data value is not valid";

        const hash = await argon2.createHash( password, {
            id,
            version,
            memoryCost,
            timeCost,
            parallelism,
            salt,
            hashLength,
            keyId,
            data,
            "raw": true,
        } );

        if ( phc ) {
            return {
                salt,
                hash,
                "phc": toPhc( {
                    id,
                    version,
                    "params": {
                        "m": memoryCost,
                        "t": timeCost,
                        "p": parallelism,
                        "data": data.length
                            ? data
                            : undefined,
                    },
                    salt,
                    hash,
                } ),
            };
        }
        else {
            return {
                salt,
                hash,
            };
        }
    }

    async #createScryptHash ( password, { id, phc, salt, hashLength, cost, blockSize, parallelism, maxMemory } ) {
        const hash = await new Promise( ( resolve, reject ) => {
            crypto.scrypt(
                password,
                salt,
                hashLength,
                {
                    cost,
                    blockSize,
                    "parallelization": parallelism,
                    "maxmem": maxMemory,
                },
                ( e, hash ) => {
                    if ( e ) {
                        reject( e );
                    }
                    else {
                        resolve( hash );
                    }
                }
            );
        } );

        if ( phc ) {
            return {
                salt,
                hash,
                "phc": toPhc( {
                    id,
                    "version": undefined,
                    "params": {
                        "ln": cost,
                        "r": blockSize,
                        "p": parallelism,
                    },
                    salt,
                    hash,
                } ),
            };
        }
        else {
            return {
                salt,
                hash,
            };
        }
    }

    async #createPbkdf2Hash ( password, { id, phc, salt, hashLength, digest, iterations } ) {
        const hash = await new Promise( ( resolve, reject ) => {
            crypto.pbkdf2( password, salt, iterations, hashLength, digest, ( e, hash ) => {
                if ( e ) {
                    reject( e );
                }
                else {
                    resolve( hash );
                }
            } );
        } );

        if ( phc ) {
            return {
                salt,
                hash,
                "phc": toPhc( {
                    id,
                    "version": undefined,
                    "params": {
                        "i": iterations,
                    },
                    salt,
                    hash,
                } ),
            };
        }
        else {
            return {
                salt,
                hash,
            };
        }
    }
}
