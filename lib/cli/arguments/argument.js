import Option from "../option.js";

export default class CLIArgument extends Option {
    startPosition;
    endPosition;
    freePositions = false;

    #helpUsage;
    #helpSpec;

    constructor ( name, config, startPosition ) {
        super( name, config );

        this.startPosition = startPosition;
        if ( this.minItems !== this.maxItems ) this.freePositions = true;
        if ( this.maxItems ) this.endPosition = this.startPosition + this.maxItems;
    }

    // properties
    get isArgument () {
        return true;
    }

    // public
    getHelpUsage () {
        if ( this.#helpUsage == null ) {
            var usage = `<${this.name}>`;

            usage += "";

            if ( this.isArray ) {
                usage += "...";
            }

            if ( !this.required ) usage = `[${usage}]`;

            this.#helpUsage = usage;
        }

        return this.#helpUsage;
    }

    getHelpSpec () {
        if ( this.#helpSpec == null ) {
            var help = `<${this.name}> : ${this._getHelpType()}`;

            this.#helpSpec = help;
        }

        return this.#helpSpec;
    }
}
