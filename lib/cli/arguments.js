const Argument = require( "./arguments/argument" );

module.exports = class {
    arguments = {};

    #totalArguments = 0;
    #nextArgument = null;
    #helpUsage = null;
    #help = null;

    // TODO validate min / mix
    constructor ( args ) {
        if ( !args ) return;

        var hasFreePositions = false;

        for ( const name in args ) {
            const argument = new Argument( name, args[name] );

            this.arguments[name] = argument;

            if ( argument.freePositions ) {
                if ( hasFreePositions ) this.throwSpecError( `Unable to add argument "${name}" with free positions.` );

                hasFreePositions = true;
            }

            if ( this.#nextArgument == null ) this.#nextArgument = argument;
        }
    }

    // TODO
    addValue ( value ) {
        var errors = [];

        this.#totalArguments++;

        if ( this.#nextArgument == null ) {
            errors.push( `Unknown argument "${value}"` );
        }
        else {
            errors.push( ...this.#nextArgument.addValue( value ) );
        }

        return errors;
    }

    // TODO validate required agrs
    validate () {
        var errors = [];

        return errors;
    }

    throwSpecError ( error ) {
        console.log( error );

        process.exit( 2 );
    }

    getValues () {
        var values = {};

        for ( const name in this.arguments ) {
            values[name] = this.arguments[name].value;
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
