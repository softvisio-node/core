import CLI from "#lib/cli";

export default class CLICommand {
    #name;
    #short;
    #target;

    constructor ( name, spec ) {
        this.#name = name;

        if ( Array.isArray( spec ) ) {
            this.#short = spec[0];
            this.#target = spec[1];
        }
        else {
            this.#target = spec;
        }
    }

    get name () {
        return this.#name;
    }

    get short () {
        return this.#short;
    }

    get target () {
        return this.#target;
    }

    // public
    findSpec () {
        return CLI.findSpec( this.#target );
    }
}

//
