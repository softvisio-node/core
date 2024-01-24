const SUPPORTED_MECHANISMS = {
    "PLAIN": null,
    "LOGIN": null,
    "CRAM-MD5": null,
    "SCRAM-SHA-256": null,
};

export default class Sasl {
    #username;
    #password;

    constructor ( username, password ) {
        this.#username = username;
        this.#password = password;
    }

    static async new ( mechanisms, username, password ) {
        for ( const mechanism of mechanisms ) {
            if ( mechanism in SUPPORTED_MECHANISMS ) {
                if ( !SUPPORTED_MECHANISMS[ mechanism ] ) SUPPORTED_MECHANISMS[ mechanism ] = ( await import( "#lib/sasl/" + mechanism.toLowerCase() ) ).default;

                return new SUPPORTED_MECHANISMS[ mechanism ]( username, password );
            }
        }
    }

    // properties
    get username () {
        return this.#username;
    }

    get password () {
        return this.#password;
    }
}
