import ajv from "#lib/ajv";

export default class Option {
    #name;
    #config;

    #minItems;
    #maxItems;
    #value;
    #validator;
    #helpDescription;

    constructor ( name, config ) {
        this.#name = name;
        this.#config = config;

        if ( this.maxItems && this.maxItems < this.minItems ) this._throwSpecError( `maxItems must be >= minItems` );

        if ( this.#config.required != null && this.isArray ) this._throwSpecError( `required can't be used with arrays` );

        if ( this.isArray ) this.#value = [];

        // compile json schema
        this.#validator = ajv().compile( {
            "type": "object",
            "properties": {
                "value": this.itemSchema,
            },
        } );

        // set default value
        if ( this.default != null ) {
            if ( this.isArray ) this._throwSpecError( `default value can't be used with arrays` );

            const errors = this.addValue( this.default );

            if ( errors.length ) this._throwSpecError( errors[0] );
        }
    }

    // properties
    get prefix () {
        return this.isArgument ? "Argument" : "Option";
    }

    get name () {
        return this.#name;
    }

    get description () {
        return this.#config.description;
    }

    get default () {
        return this.#config.default;
    }

    get itemSchema () {
        return this.isArray ? this.#config.schema.item : this.#config.schema;
    }

    get type () {
        return this.itemSchema.type;
    }

    get required () {
        return this.default == null && this.minItems > 0;
    }

    get minItems () {
        if ( this.#minItems == null ) {
            if ( this.isArray ) {
                this.#minItems = this.#config.schema.minItems || 0;
            }
            else {
                if ( this.#config.required ) this.#minItems = 1;
                else this.#minItems = 0;
            }
        }

        return this.#minItems;
    }

    get maxItems () {
        if ( this.#maxItems == null ) {
            if ( this.isArray ) {
                this.#maxItems = this.#config.schema.maxItems || 0;
            }
            else {
                this.#maxItems = 1;
            }
        }

        return this.#maxItems;
    }

    get isArray () {
        return this.#config.schema.type === "array";
    }

    get value () {
        return this.#value;
    }

    // public
    addValue ( value ) {
        var errors = [],
            data = { value },
            isValid = this.#validator( data );

        if ( !isValid ) {
            errors.push( `${this.prefix} "${this.name}" ${this.#validator.errors[0].message}` );
        }
        else {
            if ( this.isArray ) {
                if ( this.maxItems && this.#value.length === this.maxItems ) {
                    errors.push( `${this.prefix} "${this.name}" can be repeated not more than ${this.maxItems} time(s)` );
                }

                this.#value.push( data.value );
            }
            else {
                this.#value = data.value;
            }
        }

        return errors;
    }

    validate () {
        var errors = [];

        if ( this.isArray ) {

            // check minItems
            if ( this.minItems && this.value.length < this.minItems ) errors.push( `${this.prefix} "${this.name}" must be specified at least ${this.minItems} time(s).` );

            // check maxItems
            if ( this.maxItems && this.value.length > this.maxItems ) errors.push( `${this.prefix} "${this.name}" must be specified not more than ${this.maxItems} time(s).` );
        }

        // check required
        else if ( this.required && this.value == null ) {
            errors.push( `${this.prefix} "${this.name}" is required.` );
        }

        return errors;
    }

    getHelpDescription () {
        if ( this.#helpDescription == null ) {
            var tags = [];

            if ( this.required ) {
                tags.push( "[REQUIRED]" );
            }

            // do not print default value for boolean options
            if ( this.default != null && !this.isBoolean ) {
                tags.push( "[default: " + this._getHelpDefaultValue() + "]" );
            }

            if ( this.itemSchema.minimum != null ) {
                tags.push( "[min: " + this.itemSchema.minimum + "]" );
            }

            if ( this.itemSchema.maximum != null ) {
                tags.push( "[max: " + this.itemSchema.maximum + "]" );
            }

            if ( this.isArray ) {
                tags.push( "[repeatable]" );
            }

            this.#helpDescription = this.description;

            if ( tags.length ) this.#helpDescription += " " + tags.join( ", " ) + ".";
        }

        return this.#helpDescription;
    }

    // protected
    _throwSpecError ( error ) {
        console.log( `Argument "${this.name}" ${error}.` );

        process.exit( 2 );
    }

    _getHelpDefaultValue () {
        if ( this.type === "string" ) {
            return `"${this.default}"`;
        }
        else {
            return this.default;
        }
    }

    _getHelpType () {
        if ( this.type === "string" ) {
            return this.itemSchema.format || this.type;
        }
        else {
            return this.type;
        }
    }
}
