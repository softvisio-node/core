const defineMixin = require( "@softvisio/core/lib/mixins" );
const Option = require( "./cli/option" );

const reservedNames = {
    "?": true,
    "help": true,
    "version": true,
};

module.exports = defineMixin( ( SuperClass ) =>
    class extends SuperClass {
        constructor () {
            super();

            new Cli( this );
        }
    } );

class Cli {
    object = null;
    argv = null;

    spec = null;
    opts = {};
    args = {};

    constructor ( object, argv ) {
        var spec = object.cli ? object.cli() : object.constructor.cli ? object.constructor.cli() : null;

        this.spec = spec || {};

        this.object = object;
        this.argv = argv || process.argv.slice( 2 );

        // process commands
        if ( spec.commands ) {
            this.processCommands();
        }

        // process options
        else {
            this.processOptions();
        }
    }

    processCommands () {
        var argv = this.argv,
            spec = this.spec;

        const command = argv.shift();

        if ( !command || command.charAt( 0 ) === "-" ) this.throw( "Command is required." );

        const possibleCommands = [];

        // find matching commands
        for ( const commandName in spec.commands ) {
            if ( commandName.indexOf( command ) === 0 ) {
                possibleCommands.push( commandName );
            }
        }

        // no matching commands
        if ( possibleCommands.length === 0 ) {
            this.throw( `Command "${command}" is unknown.` );
        }

        // more than 1 matching command
        else if ( possibleCommands.length > 1 ) {
            this.throw( `Command "${command}" is ambiguous. Possible commands: ${possibleCommands.join( ", " )}.` );
        }

        // command found
        else {
            new Cli( spec.commands[possibleCommands[0]], argv );

            return;
        }
    }

    processOptions () {
        var argv = this.argv,
            spec = this.spec;

        var options = {},
            short = {},
            args = [];

        // prepare spec
        if ( !spec.options ) spec.options = {};

        // prepare options
        for ( const name in spec.options ) {
            spec.options[name].name = name;

            const option = ( options[name] = new Option( spec.options[name] ) );

            this.opts[name] = option;

            if ( reservedNames[name] ) this.throw( `Option name "${name}" is reserved.` );

            if ( option.short != null ) {
                if ( reservedNames[option.short] ) this.throw( `Short option name "${option.short}" is reserved.` );

                // short option name is already defined
                if ( short[option.short] != null ) {
                    this.throw( `Short option name "${option.short}" is not unique.` );
                }
                else {
                    short[option.short] = option;
                }
            }
        }

        while ( argv.length > 0 ) {
            let arg = argv.shift();

            // option
            if ( arg.charAt( 0 ) === "-" ) {
                let value, hasArgument;

                // parse option argument
                const eqIndex = arg.indexOf( "=" );

                if ( eqIndex !== -1 ) {
                    value = arg.substring( eqIndex + 1 );
                    arg = arg.substring( 0, eqIndex );
                    hasArgument = true;
                }

                // long option
                if ( arg.substring( 0, 2 ) === "--" ) {
                    let name = arg.substring( 2 );

                    if ( name === "help" ) this.printHelp();
                    if ( name === "version" ) this.printVersion();

                    // negated boolean option
                    if ( name.substring( 0, 3 ) === "no-" ) {
                        name = name.substring( 3 );

                        value = false;
                    }

                    // option is unknown
                    if ( !options[name] ) this.throw( `Option "${name}" is unknown.` );

                    if ( !options[name].requireArgument ) {
                        if ( hasArgument ) this.throw( `Option "${name}" does not requires argument.` );

                        if ( value == null ) value = true;

                        options[name].setValue( value );
                    }
                    else {
                        if ( !hasArgument ) {
                            value = argv.shift();

                            if ( value == null || value.charAt( 0 ) === "-" ) this.throw( `Option "${name}" requires argument.` );
                        }

                        options[name].setValue( value );
                    }
                }

                // short option
                else {
                    arg = arg.substr( 1 );

                    const opts = arg.split( "" );

                    // hangle "-=value"
                    if ( !opts.length ) this.throw( `Invalid short option usage` );

                    while ( opts.length ) {
                        const name = opts.shift();

                        if ( name === "?" ) this.printHelp();

                        if ( short[name] == null ) this.throw( `Option "${name}" is unknown.` );

                        // not last short option
                        if ( opts.length ) {
                            // boolean short option
                            if ( !short[name].requireArgument ) {
                                short[name].setValue( true );
                            }
                            else {
                                this.throw( `Option "${name}" does not requires argument.` );
                            }
                        }

                        // last short option
                        else {
                            // boolean short option
                            if ( !short[name].requireArgument ) {
                                if ( hasArgument ) this.throw( `Option "${name}" does not requires argument.` );

                                short[name].setValue( true );
                            }
                            else {
                                if ( !hasArgument ) {
                                    value = argv.shift();

                                    if ( value == null || value.charAt( 0 ) === "-" ) this.throw( `Option "${name}" requires argument.` );
                                }

                                short[name].setValue( value );
                            }
                        }
                    }
                }
            }

            // argument
            else {
                args.push( arg );
            }
        }

        process.cli = {};
        process.cli.opts = {};
        process.cli.args = {};

        // check required options
        for ( const name in options ) {
            if ( options[name].value == null && options[name].required ) this.throw( `Option "${name}" is required.` );

            process.cli.opts[name] = options[name].value;
        }

        // TODO
        // distribute named arguments

        console.log( options, args );
    }

    throw ( error ) {
        console.log( error );

        process.exit( 2 );
    }

    // TODO
    printHelp () {
        console.log( "help will be here" );

        // exit process
        process.exit( 2 );
    }

    printVersion () {
        console.log( `veersion` );

        process.exit( 0 );
    }
}

//
