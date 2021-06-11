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
        if ( this.#target.cli && typeof this.#target.cli === "function" ) {
            return this.#target.cli();
        }
        else if ( this.#target.constructor.cli && typeof this.#target.constructor.cli === "function" ) {
            return this.#target.constructor.cli();
        }
    }
}

//
