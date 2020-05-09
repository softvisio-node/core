const Argument = require( "./arguments/argument" );

module.exports = class {
    arguments = {};

    #nextPosition = 0;
    #order = [];
    #helpUsage = null;
    #help = null;

    constructor ( args ) {
        if ( !args ) return;

        var hasFreePositions = false,
            startPosition = 0;

        for ( const name in args ) {
            const argument = new Argument( name, args[name], startPosition );

            if ( argument.freePositions ) {
                if ( hasFreePositions ) this.throwSpecError( `Unable to add argument "${name}" with free positions.` );

                hasFreePositions = true;
            }
            else {
                if ( argument.endPosition ) startPosition += argument.endPosition;
            }

            this.arguments[name] = argument;
            this.#order.push( argument );
        }

        console.log( this );
        process.exit();
    }

    // TODO
    addValue ( value ) {
        var errors = [],
            argument = this.#order[0];

        if ( !argument ) {
            errors.push( `Unexpected argument "${value}"` );
        }
        else {
            errors.push( ...argument.addValue( value ) );

            this.#nextPosition++;

            if ( argument.endPosition && this.#nextPosition > argument.endPosition ) this.#order.shift();
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
