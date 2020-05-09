const Ajv = require( "ajv" );

module.exports = class {
    schema = null;

    data = [];

    #validator = null;

    #helpUsage = null;
    #help = null;

    constructor ( schema ) {
        this.schema = schema;

        var ajv = new Ajv( { "coerceTypes": true } );

        // compile json schema
        this.#validator = ajv.compile( {
            ...this.schema,
            "type": "array",
        } );
    }

    // TODO
    addValue ( value ) {
        var errors = [];

        this.data.push( value );

        return errors;
    }

    validate () {
        if ( this.#validator( this.data ) ) {
            return [];
        }
        else {
            return this.#validator.errors.map( ( error ) => error.message );
        }
    }

    // TODO
    getValues () {
        var values = {};

        return values;
    }

    // TODO
    getHelpUsage () {
        if ( this.#helpUsage == null ) {
            this.#helpUsage = "";
        }

        return this.#helpUsage;
    }

    // TODO
    getHelp () {
        if ( this.#help == null ) {
            this.#help = "";
        }

        return this.#help;
    }
};
