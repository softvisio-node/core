const defineMixin = require( "./mixins" );
const Options = require( "./cli/options" );
const Arguments = require( "./cli/arguments" );
const path = require( "path" );
const Ajv = require( "ajv" );
const fs = require( "./fs" );

var cliSpecValidator;

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
    commands = null;

    spec = null;
    options = null;
    arguents = null;

    constructor ( object, argv, commands ) {
        var spec = object.cli ? object.cli() : object.constructor.cli ? object.constructor.cli() : null;

        this.spec = spec || {};

        // validate cli spec
        if ( !cliSpecValidator ) cliSpecValidator = new Ajv().compile( fs.config.read( __dirname + "/../resources/schemas/cli.meta.schema.yaml" ) );

        if ( !cliSpecValidator( this.spec ) ) {
            console.log( "CLI spec is not valid, inspect errors below:" );

            console.log( cliSpecValidator.errors );

            process.exit( 2 );
        }

        this.commands = commands || [];

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
            this.commands.push( possibleCommands[0] );

            new Cli( spec.commands[possibleCommands[0]], argv, this.commands );

            return;
        }
    }

    processOptions () {
        var argv = this.argv;

        // prepare options
        this.options = new Options( this.spec.options );

        // prepare arguments
        this.arguments = new Arguments( this.spec.arguments );

        var errors = [];

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

                    // global options
                    if ( name === "help" ) this.printHelp();
                    if ( name === "version" ) this.printVersion();

                    // negated boolean option
                    if ( name.substring( 0, 3 ) === "no-" ) {
                        name = name.substring( 3 );

                        value = false;
                    }

                    const option = this.options.getOption( name );

                    // option is unknown
                    if ( !option ) {
                        errors.push( `Option "${name}" is unknown.` );

                        continue;
                    }

                    if ( !option.requireArgument ) {
                        if ( hasArgument ) {
                            errors.push( `Option "${name}" does not requires argument.` );

                            continue;
                        }

                        if ( value == null ) value = true;

                        option.setValue( value );
                    }
                    else {
                        if ( !hasArgument ) {
                            value = argv.shift();

                            if ( value == null || value.charAt( 0 ) === "-" ) {
                                errors.push( `Option "${name}" requires argument.` );

                                continue;
                            }
                        }

                        option.setValue( value );
                    }
                }

                // short option
                else {
                    arg = arg.substr( 1 );

                    const opts = arg.split( "" );

                    // hangle "-=value"
                    if ( !opts.length ) {
                        errors.push( `Invalid short option usage` );

                        continue;
                    }

                    while ( opts.length ) {
                        const name = opts.shift();

                        // global options
                        if ( name === "?" || name === "h" ) this.printHelp();

                        const option = this.options.getOption( name );

                        if ( !option ) {
                            errors.push( `Option "${name}" is unknown.` );

                            continue;
                        }

                        // not last short option
                        if ( opts.length ) {
                            // boolean short option
                            if ( !option.requireArgument ) {
                                option.setValue( true );
                            }
                            else {
                                errors.push( `Option "${name}" does not requires argument.` );

                                continue;
                            }
                        }

                        // last short option
                        else {
                            // boolean short option
                            if ( !option.requireArgument ) {
                                if ( hasArgument ) {
                                    errors.push( `Option "${name}" does not requires argument.` );

                                    continue;
                                }

                                option.setValue( true );
                            }
                            else {
                                if ( !hasArgument ) {
                                    value = argv.shift();

                                    if ( value == null || value.charAt( 0 ) === "-" ) {
                                        errors.push( `Option "${name}" requires argument.` );

                                        continue;
                                    }
                                }

                                option.setValue( value );
                            }
                        }
                    }
                }
            }

            // argument
            else {
                this.arguments.addValue( arg );
            }
        }

        // validate options
        errors.push( ...this.options.validate() );

        // validate arguments
        errors.push( ...this.arguments.validate() );

        if ( errors.length ) this.throw( errors );

        process.cli = {};
        process.cli.opts = this.options.getValues();
        process.cli.args = this.arguments.getValues();

        console.log( process.cli );
    }

    throw ( errors ) {
        console.log( Array.isArray( errors ) ? errors.join( "\n" ) : errors );

        console.log( "" );

        this.printHelp( 2 );
    }

    printHelp ( exitCode ) {
        if ( this.spec.summary ) console.log( this.spec.summary + "\n" );

        if ( this.spec.description ) console.log( this.spec.description + "\n" );

        var usage = "usage: " + path.basename( process.argv[1] );

        if ( this.commands.length ) usage += " " + this.commands.join( " " );

        if ( this.spec.commands ) {
            usage += " <command>";

            this.printCommandsHelp( usage );
        }
        else {
            this.printOptionsHelp( usage );
        }

        // exit process
        process.exit( exitCode );
    }

    printCommandsHelp ( usage ) {
        var commands = this.spec.commands;

        console.log( usage + "\n" );

        console.log( "where <command> is one of:\n" );

        let maxLength = 0;

        // index max option name length
        for ( const name in commands ) {
            if ( name.length > maxLength ) maxLength = name.length;
        }

        for ( const name in commands ) {
            console.log( " " + name + " ".repeat( maxLength - name.length ) + " ".repeat( 6 ) + commands[name].summary );
        }

        console.log( "\nglobal options: --help, -h, -?, --version" );
    }

    // TODO
    printOptionsHelp ( usage ) {
        var options = "";

        if ( Object.keys( this.opts ).length ) {
            options += "\noptions:\n\n";

            let maxLength = 0;

            // index max option name length
            for ( const name in this.opts ) {
                const length = this.opts[name].getSpec().length;

                if ( length > maxLength ) maxLength = length;
            }

            for ( const name in this.opts ) {
                const opt = this.opts[name];

                usage += " " + opt.getUsage();

                let optSpec = opt.getSpec() + " ".repeat( maxLength - opt.getSpec().length );

                optSpec += " " + opt.getDescription();

                options += optSpec + "\n";
            }
        }

        console.log( usage );

        console.log( options );

        console.log( "global options: --help, -h, -?, --version" );
    }

    // TODO
    printVersion () {
        console.log( `veersion` );

        process.exit( 0 );
    }
}

//
