const Option = require( "./options/option" );

const reservedNames = {
    "?": true,
    "h": true,
    "help": true,
    "version": true,
};

module.exports = class {
    options = {};
    short = {};

    #helpUsage = null;
    #help = null;

    constructor ( options ) {
        if ( !options ) return;

        for ( const name in options ) {
            const option = new Option( name, options[name] );

            this.options[name] = option;

            if ( reservedNames[name] ) this.throwSpecError( `Option name "${name}" is reserved.` );

            if ( option.short != null ) {
                if ( reservedNames[option.short] ) this.throwSpecError( `Short option name "${option.short}" is reserved.` );

                // short option name is already defined
                if ( this.short[option.short] != null ) {
                    this.throwSpecError( `Short option name "${option.short}" is not unique.` );
                }
                else {
                    this.short[option.short] = option;
                }
            }
        }
    }

    getOption ( name ) {
        return this.options[name] || this.short[name];
    }

    validate () {
        var errors = [];

        for ( const name in this.options ) {
            errors.push( ...this.options[name].validate() );
        }

        return errors;
    }

    getValues () {
        var values = {};

        for ( const name in this.options ) {
            values[name] = this.options[name].value;
        }

        return values;
    }

    throwSpecError ( error ) {
        console.log( error );

        process.exit( 2 );
    }

    getHelpUsage () {
        if ( this.#helpUsage == null ) {
            var usage = [];

            for ( const name in this.options ) {
                usage.push( this.options[name].getHelpUsage() );
            }

            if ( usage.length ) {
                this.#helpUsage = " " + usage.join( " " );
            }
            else {
                this.#helpUsage = "";
            }
        }

        return this.#helpUsage;
    }

    getHelp () {
        if ( this.#help == null ) {
            var maxLength = 0;

            // index max length
            for ( const name in this.options ) {
                const length = this.options[name].getHelpSpec().length;

                if ( length > maxLength ) maxLength = length;
            }

            if ( !maxLength ) {
                this.#help = "";
            }
            else {
                var help = [];

                for ( const name in this.options ) {
                    const option = this.options[name],
                        spec = option.getHelpSpec(),
                        desc = option.getHelpDescription();

                    help.push( "  " + spec + " ".repeat( maxLength - spec.length ) + " " + desc );
                }

                this.#help = help.join( "\n" );
            }
        }

        return this.#help;
    }
};
