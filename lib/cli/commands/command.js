export default class CliCommand {
    #name;
    #spec;
    #module;

    constructor ( name, spec ) {
        this.#name = name;
        this.#spec = spec;
    }

    get name () {
        return this.#name;
    }

    get short () {
        return this.#spec.short;
    }

    get title () {
        return this.#spec.title;
    }

    // public
    async getModule () {
        if ( !this.#spec.module ) {
            const config = { ...this.#spec };

            delete config.short;

            return config;
        }
        else {
            if ( !this.#module ) {
                let module = this.#spec.module;

                if ( typeof module === "function" ) module = await module();

                if ( typeof module === "string" || module instanceof URL ) module = ( await import( module ) ).default;

                this.#module = module;
            }

            return this.#module;
        }
    }
}

//
