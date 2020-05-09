const Ajv = require( "ajv" );

module.exports = class {
    name = null;
    summary = null;
    default = null;
    minItems = null;
    maxItems = null;
    schema = null;

    startPosition = null;
    endPosition = null;
    freePositions = false;
    isArray = false;
    required = false;
    value = null;

    #validator = null;

    #helpUsage = null;
    #helpSpec = null;
    #helpDescription = null;

    constructor ( name, option, startPosition ) {
        this.name = name;
        this.summary = option.summary;
        this.default = option.default;
        this.minItems = option.minItems || 0;
        this.maxItems = option.maxItems || this.minItems || 1;
        this.schema = option.schema;
        this.startPosition = startPosition;

        // compile json schema
        this.#validator = new Ajv( { "coerceTypes": true } ).compile( {
            "type": "object",
            "properties": {
                "value": this.schema,
            },
        } );

        if ( this.minItems > 1 ) this.required = true;

        if ( this.maxItems && this.maxItems < this.minItems ) this.throwSpecError( `maxItems must be >= minItems` );

        if ( !this.maxItems || this.maxItems > 1 ) {
            this.isArray = true;

            this.value = [];
        }

        if ( this.minItems !== this.maxItems ) this.freePositions = true;

        if ( this.maxItems ) this.endPosition = this.startPosition + this.maxItems;

        // set default value
        if ( this.default != null ) {
            if ( this.isArray ) this.throwSpecError( `default value for array option is not supported` );

            this.required = false;

            const errors = this.setValue( this.default );

            if ( errors.length ) this.throwSpecError( errors[0] );
        }
    }

    throwSpecError ( error ) {
        console.log( `Argument "${this.name}" ${error}.` );

        process.exit( 2 );
    }

    addValue ( value ) {
        var errors = [],
            data = { value };

        var isValid = this.#validator( data );

        if ( !isValid ) {
            errors.push( this.#validator.errors[0].message );
        }
        else {
            if ( this.isArray ) {
                this.value.push( data.value );
            }
            else {
                this.value = data.value;
            }
        }

        return errors;
    }
};
