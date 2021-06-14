import Option from "../option.js";

export default class CLIOption extends Option {
    #short;

    // boolean option props
    allowNegated;
    negatedOnly;

    #helpUsage;
    #helpSpec;
    #helpDescription;

    constructor ( name, config ) {
        super( name, config );

        this.#short = config.short;

        if ( this.#short == null ) {
            if ( this.negatedOnly ) this.#short = this.name.charAt( 0 ).toUpperCase();
            else this.#short = this.name.charAt( 0 );
        }
    }

    // properties
    get isArgument () {
        return false;
    }

    get isBoolean () {
        return this.type === "boolean";
    }

    get short () {
        return this.#short;
    }

    get requireArgument () {
        return !this.isBoolean;
    }

    get allowNegated () {
        return this.isBoolean && this.default !== false;
    }

    get negatedOnly () {
        return this.isBoolean && this.default === true;
    }

    // public
    getHelpUsage () {
        if ( this.#helpUsage == null ) {
            var usage = "[";

            if ( this.short !== false ) {
                usage += "-" + this.short + ", ";
            }

            // boolean
            if ( this.schema.type === "boolean" ) {
                if ( this.default == null ) {
                    usage += "--[no-]" + this.name;
                }
                else if ( this.default === true ) {
                    usage += "--no-" + this.name;
                }
                else {
                    usage += "--" + this.name;
                }
            }
            else {
                usage += "--" + this.name + "[=]<" + this.#getHelpType() + ">";
            }

            usage += "]";

            if ( this.isArray ) {
                usage += "...";
            }

            this.#helpUsage = usage;
        }

        return this.#helpUsage;
    }

    getHelpSpec () {
        if ( this.#helpSpec == null ) {
            var help = "";

            if ( this.short !== false ) {
                help += "-" + this.short + " ";
            }
            else {
                help += " ".repeat( 3 );
            }

            // boolean
            if ( this.schema.type === "boolean" ) {
                if ( this.default == null ) {
                    help += "--[no-]" + this.name;
                }
                else if ( this.default === true ) {
                    help += "--no-" + this.name;
                }
                else {
                    help += "--" + this.name;
                }
            }
            else {
                help += "--" + this.name + "[=]<" + this.#getHelpType() + ">";
            }

            this.#helpSpec = help;
        }

        return this.#helpSpec;
    }

    getHelpDescription () {
        if ( this.#helpDescription == null ) {
            var tags = [];

            if ( this.required ) {
                tags.push( "[REQUIRED]" );
            }

            // do not print default value for boolean options
            if ( this.default != null && this.requireArgument ) {
                tags.push( "[default: " + this.#getHelpDefaultValue() + "]" );
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

    // private
    #getHelpType () {
        if ( this.schema.type === "string" ) {
            return this.schema.format || this.schema.type;
        }
        else {
            return this.schema.type;
        }
    }

    #getHelpDefaultValue () {
        if ( this.schema.type === "string" ) {
            return `"${this.default}"`;
        }
        else {
            return this.default;
        }
    }
}
