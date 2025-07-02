import Option from "../option.js";

export default class CliOption extends Option {
    #short;
    #negatedShort;
    #negetable;
    #allowTrue;
    #allowFalse;
    #helpUsage;
    #helpSpec;

    constructor ( name, config ) {
        super( name, config );

        this.#negetable = config.negetable;
        this.#short = config.short;
        this.#negatedShort = config.negatedShort;

        // boolean option
        if ( this.isBoolean ) {
            this.#negetable ??= this.default == null
                ? true
                : false;

            if ( this.isNegetable || this.default === false ) {
                this.#allowTrue = true;

                this.#short ??= this.name.charAt( 0 );
            }

            if ( this.isNegetable || this.default === true ) {
                this.#allowFalse = true;

                this.#negatedShort ??= this.name.charAt( 0 ).toUpperCase();
            }
        }

        // non-boolean option
        else {
            if ( this.#short == null ) {
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

    get isNegetable () {
        return this.#negetable;
    }

    get allowTrue () {
        return this.#allowTrue;
    }

    get allowFalse () {
        return this.#allowFalse;
    }

    get short () {
        return this.#short;
    }

    get negatedShort () {
        return this.#negatedShort;
    }

    // public
    getHelpUsage () {
        if ( this.#helpUsage == null ) {
            var usage = "[";

            if ( this.short ) {
                usage += "-" + this.short + ", ";
            }

            if ( this.negatedShort ) {
                usage += "-" + this.negatedShort + ", ";
            }

            // boolean option
            if ( this.isBoolean ) {
                if ( this.isNegetable ) {
                    usage += "--[no-]" + this.name;
                }
                else if ( this.allowTrue ) {
                    usage += "--" + this.name;
                }
                else {
                    usage += "--no-" + this.name;
                }
            }

            // non-boolean option
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

    getHelpSpec ( hasNegatedShorts ) {
        if ( this.#helpSpec == null ) {
            var help = "";

            if ( this.isNegetable ) {
                if ( this.short ) {
                    help += `-${ this.short }, `;
                }
                else {
                    help += " ".repeat( 4 );
                }

                if ( this.negatedShort ) {
                    help += `-${ this.negatedShort }, `;
                }
                else {
                    help += " ".repeat( 4 );
                }
            }
            else {
                if ( this.short || this.negatedShort ) {
                    help += `-${ this.short || this.negatedShort }, `;

                    if ( hasNegatedShorts ) {
                        help += " ".repeat( 4 );
                    }
                }
                else {
                    help += " ".repeat( hasNegatedShorts
                        ? 8
                        : 4 );
                }
            }

            // boolean option
            if ( this.isBoolean ) {
                if ( this.isNegetable ) {
                    help += "--[no-]" + this.name;
                }
                else if ( this.allowTrue ) {
                    help += "--" + this.name;
                }
                else {
                    help += "--no-" + this.name;
                }
            }

            // non-boolean option
            else {
                help += "--" + this.name + "[=]<" + this._getHelpType() + ">";
            }

            // repeatable
            if ( this.isArray ) {
                help += "...";
            }

            this.#helpSpec = help;
        }

        return this.#helpSpec;
    }
}
