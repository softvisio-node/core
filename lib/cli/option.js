const Ajv = require( "ajv" );

const ajv = new Ajv( { "coerceTypes": true } );

module.exports = class {
    name = null;
    short = null;
    summary = null;
    default = null;
    required = false;
    requireArgument = true;
    schema = null;

    value = null;

    #validator = null;
    #optSpec = null;

    constructor ( option ) {
        this.name = option.name;
        this.short = option.short;
        this.summary = option.summary;
        this.default = option.default;
        this.required = option.required;

        if ( option.type === "boolean" ) this.requireArgument = false;

        // create short name
        if ( this.short === "" ) this.short = false;

        if ( this.short !== false ) {
            if ( this.short == null ) {
                this.short = this.name.charAt( 0 );
            }
        }

        // compile json schema
        this.schema = { ...option };
        delete this.schema.name;
        delete this.schema.short;
        delete this.schema.summary;
        delete this.schema.required;
        this.#validator = ajv.compile( {
            "type": "object",
            "properties": {
                "value": this.schema,
            },
        } );

        // set default value
        if ( this.default != null ) {
            this.required = false;

            this.setValue( this.default );
        }
    }

    setValue ( value ) {
        var data = { value };

        var isValid = this.#validator( data );

        if ( !isValid ) {
            this.throw( this.#validator.errors[0].message );
        }
        else {
            this.value = data.value;
        }
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

        if ( this.default != null ) {
            tags.push( "default: " + this.default );
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
