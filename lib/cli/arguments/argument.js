import Option from "../option.js";

export default class CLIArgument extends Option {
    startPosition;
    endPosition;
    freePositions = false;

    #helpUsage;
    #helpSpec;
    #helpDescription;

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

    // XXX
    getHelpDescription () {
        if ( this.#helpDescription == null ) {
            var tags = [];

            if ( this.required ) {
                tags.push( "[REQUIRED]" );
            }

            if ( this.default != null ) {
                tags.push( "[default: " + this._getHelpDefaultValue() + "]" );
            }

            if ( this.schema.minimum != null ) {
                tags.push( "[min: " + this.schema.minimum + "]" );
            }

            if ( this.schema.maximum != null ) {
                tags.push( "[max: " + this.schema.maximum + "]" );
            }

            if ( this.isArray ) {
                tags.push( "[repeatable]" );
            }

            this.#helpDescription = this.description;

            if ( tags.length ) this.#helpDescription += " " + tags.join( ", " ) + ".";
        }

        return this.#helpDescription;
    }
}
