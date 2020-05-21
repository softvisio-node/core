const argon2 = require( "argon2" );

module.exports = class {
    #params;

    constructor ( options ) {
        if ( !options ) options = {};

        this.#params = {
            "type": options.type || argon2.argon2i,
            "hashLength": options.hashLength || 32,
            "timeCost": options.timeCost || 3,
            "memoryCost": options.memoryCost || 4096,
            "parallelism": options.parallelism || 1,
            "saltLength": options.saltLength || 16,
        };
    }

    async API_hash ( password ) {
        const hash = await argon2.hash( password, this.#params );

        return [200, hash];
    }

    async API_verify ( hash, password ) {
        if ( await argon2.verify( hash, password ) ) {
            return 200;
        }
        else {
            return 404;
        }
    }
};
