require( "#index" );

const argon2 = require( "@softvisio/argon2" );

module.exports = class {
    #params;

    constructor ( options ) {
        if ( !options ) options = {};

        this.#params = {
            "type": options.type || argon2.argon2id,
            "hashLength": options.hashLength || 32,
            "timeCost": options.timeCost || 3,
            "memoryCost": options.memoryCost || 4096,
            "parallelism": options.parallelism || 1,
            "saltLength": options.saltLength || 16,
        };
    }

    async RPC_hash ( password ) {
        const hash = await argon2.hash( password, this.#params );

        return result( 200, hash );
    }

    async RPC_verify ( hash, password ) {
        if ( await argon2.verify( hash, password ) ) {
            return result( 200 );
        }
        else {
            return result( [404, "Password is invalid"] );
        }
    }
};
