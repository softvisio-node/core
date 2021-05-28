import ajv from "#lib/ajv";

export default class CLIOption {
    name;
    summary;
    default;
    minItems;
    maxItems;
    schema;

    short;
    isArray = false;
    required = false;
    value;

    // boolean option props
    requireArgument = true;
    allowNegated;
    negatedOnly;

    #validator;

    #helpUsage;
    #helpSpec;
    #helpDescription;

    constructor ( name, option ) {
        this.name = name;
        this.short = option.short;
        this.summary = option.summary;
        this.default = option.default;
        this.minItems = option.minItems || 0;
        this.maxItems = option.maxItems == null ? this.minItems || 1 : option.maxItems;
        this.schema = option.schema;

        // boolean options
        if ( this.schema.type === "boolean" ) {
            this.requireArgument = false;

            // no default value, option can be negated
            if ( this.default == null ) {
                this.allowNegated = true;
            }

            // has default value
            else {

                // default is true - only negated value is allowed
                if ( this.default === true ) {
                    this.allowNegated = true;
                    this.negatedOnly = true;

                    if ( this.short == null ) this.short = this.name.charAt( 0 ).toUpperCase();
                }
            }
        }

        if ( this.short == null ) this.short = this.name.charAt( 0 );

        // compile json schema
        this.#validator = ajv().compile( {
            "type": "object",
            "properties": {
                "value": this.schema,
            },
        } );

        if ( this.minItems >= 1 ) this.required = true;

        if ( this.maxItems && this.maxItems < this.minItems ) this.#throwSpecError( `maxItems must be >= minItems` );

        if ( !this.maxItems || this.maxItems > 1 ) {
            this.isArray = true;

            this.value = [];
        }

        // set default value
        if ( this.default != null ) {
            if ( this.isArray ) this.#throwSpecError( `default value for array option is not supported` );

            this.required = false;

            const errors = this.setValue( this.default );

            if ( errors.length ) this.#throwSpecError( errors[0] );
        }
    }

    setValue ( value ) {
        const errors = [],
            data = { value },
            isValid = this.#validator( data );

        if ( !isValid ) {
            errors.push( this.#validator.errors[0].message );
        }
        else {
            if ( this.isArray ) {
                if ( this.maxItems && this.value.length === this.maxItems ) {
                    errors.push( `can be repeated not more than ${this.maxItems} time(s)` );
                }

                this.value.push( data.value );
            }
            else {
                this.value = data.value;
            }
        }

        return errors;
    }

    validate () {
        var errors = [];

        if ( this.isArray ) {
            if ( this.minItems && this.value.length < this.minItems ) errors.push( `Option "${this.name}" must be specified at least ${this.minItems} time(s).` );

            if ( this.maxItems && this.value.length > this.maxItems ) errors.push( `Option "${this.name}" must be specified not more than ${this.maxItems} time(s).` );
        }
        else if ( this.required && this.value == null ) {
            errors.push( `Option "${this.name}" is required.` );
        }

        return errors;
    }

    #throwSpecError ( error ) {
        console.log( `Option "${this.name}" ${error}.` );

        process.exit( 2 );
    }

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

            this.#helpDescription = this.summary;

            if ( tags.length ) this.#helpDescription += " " + tags.join( ", " ) + ".";
        }

        return this.#helpDescription;
    }

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
