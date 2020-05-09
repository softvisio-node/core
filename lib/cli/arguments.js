const Argument = require( "./arguments/argument" );

module.exports = class {
    arguments = {};

    #helpUsage = null;
    #help = null;

    // TODO validate min / mix
    constructor ( args ) {
        if ( !args ) return;

        for ( const name in args ) {
            const argument = new Argument( name, args[name] );

            this.arguments[name] = argument;
        }
    }

    // TODO
    addValue ( value ) {
        var errors = [];

        this.data.push( value );

        return errors;
    }

    // TODO validate required agrs
    validate () {
        var errors = [];

        return errors;
    }

    getValues () {
        var values = {};

        for ( const name in this.options ) {
            values[name] = this.options[name].value;
        }

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
