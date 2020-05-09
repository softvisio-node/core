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
};
