import Option from "../option.js";

export default class CliOption extends Option {
    #short;

    #helpUsage;
    #helpSpec;

    constructor ( name, config ) {
        super( name, config );

        this.#short = config.short;

        if ( this.#short == null ) {
            if ( this.negatedOnly ) {
                this.#short = this.name.charAt( 0 ).toUpperCase();
            }
            else {
                this.#short = this.name.charAt( 0 );
            }
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
            if ( this.isBoolean ) {
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
                usage += "--" + this.name + "[=]<" + this._getHelpType() + ">";
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
            if ( this.isBoolean ) {
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
                help += "--" + this.name + "[=]<" + this._getHelpType() + ">";
            }

            this.#helpSpec = help;
        }

        return this.#helpSpec;
    }
}
