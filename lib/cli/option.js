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
};
