const Argument = require( "./arguments/argument" );

module.exports = class {
    items = {};

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

            this.items[name] = argument;
            this.#order.push( argument );
        }
    }

    addValue ( value ) {
        var errors = [],
            argument = this.#order[0];

        if ( !argument ) {
            errors.push( `Unexpected argument "${value}"` );
        }
        else {
            errors.push( ...argument.addValue( value ) );

            this.#nextPosition++;

            if ( argument.endPosition && this.#nextPosition === argument.endPosition ) this.#order.shift();
        }

        return errors;
    }

    validate () {
        var errors = [];

        for ( const name in this.items ) {
            errors.push( ...this.items[name].validate() );
        }

        return errors;
    }

    throwSpecError ( error ) {
        console.log( error );

        process.exit( 2 );
    }

    getValues () {
        var values = {};

        for ( const name in this.items ) {
            values[name] = this.items[name].value;
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
