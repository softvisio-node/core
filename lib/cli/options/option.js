const Ajv = require( "ajv" );

const ajv = new Ajv( { "coerceTypes": true } );

module.exports = class {
    name = null;
    summary = null;
    minItems = 0;
    maxItems = null;
    schema = null;

    short = null;
    isArray = false;
    required = false;
    requireArgument = true;
    value = null;

    #validator = null;
    #optSpec = null;

    constructor ( name, option ) {
        this.name = name;
        this.short = option.short;
        this.summary = option.summary;
        if ( option.minItems !== undefined ) this.minItems = option.minItems;
        this.maxItems = option.maxItems;
        this.schema = option.schema;

        // create short name
        if ( this.short === "" ) this.short = false;
        if ( this.short == null ) this.short = this.name.charAt( 0 );

        if ( this.minItems > 1 ) this.required = true;

        if ( this.maxItems && this.maxItems < this.minItems ) this.throw( `maxItems must be >= minItems` );

        if ( !this.maxItems || this.maxItems > this.minItems ) {
            this.value = [];

            this.isArray = true;
        }

        // compile json schema
        this.#validator = ajv.compile( {
            "type": "object",
            "properties": {
                "value": this.schema,
            },
        } );

        // set default value
        if ( this.schema.default != null ) {
            this.required = false;

            this.setValue( this.schema.default );
        }

        // define requireArgument property
        if ( this.schema.type === "boolean" ) this.requireArgument = false;
    }

    setValue ( value ) {
        var data = { value };

        var isValid = this.#validator( data );

        if ( !isValid ) {
            this.throw( this.#validator.errors[0].message );
        }
        else {
            if ( this.isArray ) {
                if ( this.maxItems && this.value.length === this.maxItems ) {
                    this.throw( `can be repeated not more than ${this.maxItems} times` );
                }

                this.value.push( data.value );
            }
            else {
                this.value = data.value;
            }
        }
    }

    // TODO
    validate () {
        var errors = [];

        if ( this.isArray ) {
            if ( this.minItems && this.value.length < this.minItems ) errors.push( `Option "${this.name}" value is required.` );

            if ( this.maxItems && this.value.length > this.maxItems ) errors.push( `Option "${this.name}" value is required.` );
        }
        else if ( this.required && this.value == null ) {
            errors.push( `Option "${this.name}" value is required.` );
        }

        return errors;
    }

    throw ( error ) {
        console.log( `Option "${this.name}" ${error}.` );

        process.exit( 2 );
    }

    getUsage () {
        var usage = "[";

        if ( this.short !== false ) {
            usage += "-" + this.short + ", ";
        }

        if ( this.schema.type === "boolean" ) {
            if ( this.schema.default == null ) {
                usage += "--[no-]" + this.name;
            }
            else if ( this.schema.default === true ) {
                usage += "--no-" + this.name;
            }
            else {
                usage += "--" + this.name;
            }
        }
        else {
            usage += "--" + this.name + "[=]<" + this.getType() + ">";
        }

        usage += "]";

        return usage;
    }

    getSpec () {
        if ( !this.#optSpec ) {
            var usage = " ";

            if ( this.short !== false ) {
                usage += "-" + this.short + " ";
            }
            else {
                usage += " ".repeat( 3 );
            }

            if ( this.schema.type === "boolean" ) {
                if ( this.schema.default == null ) {
                    usage += "--[no-]" + this.name;
                }
                else if ( this.schema.default === true ) {
                    usage += "--no-" + this.name;
                }
                else {
                    usage += "--" + this.name;
                }
            }
            else {
                usage += "--" + this.name + "[=]<" + this.getType() + ">";
            }

            this.#optSpec = usage;
        }

        return this.#optSpec;
    }

    getType () {
        if ( this.schema.type === "string" ) {
            return this.schema.format || this.schema.type;
        }
        else {
            return this.schema.type;
        }
    }

    getDescription () {
        var tags = [];

        if ( this.required ) {
            tags.push( "required" );
        }

        if ( this.schema.default != null ) {
            tags.push( "default: " + this.schema.default );
        }

        if ( this.schema.minimum != null ) {
            tags.push( "min: " + this.schema.minimum );
        }

        if ( this.schema.maximum != null ) {
            tags.push( "max: " + this.schema.maximum );
        }

        if ( this.summary ) {
            return this.summary + ", " + tags.join( ", " );
        }
        else {
            return tags.join( ", " );
        }
    }
};
