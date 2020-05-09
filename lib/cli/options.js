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

    constructor ( options ) {
        if ( !options ) return;

        for ( const name in options ) {
            const option = new Option( name, options[name] );

            this.options[name] = option;

            if ( reservedNames[name] ) this.throw( `Option name "${name}" is reserved.` );

            if ( option.short != null ) {
                if ( reservedNames[option.short] ) this.throw( `Short option name "${option.short}" is reserved.` );

                // short option name is already defined
                if ( this.short[option.short] != null ) {
                    this.throw( `Short option name "${option.short}" is not unique.` );
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

    throw ( error ) {
        console.log( error );

        process.exit( 2 );
    }

    getHelp ( usage ) {
        var help = "";

        if ( Object.keys( this.options ).length ) {
            help += "\noptions:\n\n";

            let maxLength = 0;

            // index max option name length
            for ( const name in this.options ) {
                const length = this.options[name].getSpec().length;

                if ( length > maxLength ) maxLength = length;
            }

            for ( const name in this.options ) {
                const option = this.options[name];

                usage += " " + option.getUsage();

                let optSpec = option.getSpec() + " ".repeat( maxLength - option.getSpec().length );

                optSpec += " " + option.getDescription();

                help += optSpec + "\n";
            }
        }

        return usage + help;
    }
};
