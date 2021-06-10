import "#index";

import Options from "#lib/cli/options";
import Arguments from "#lib/cli/arguments";
import path from "path";
import ajv from "#lib/ajv";
import fs from "#lib/fs";
import env from "#lib/env";

var cliSpecValidator;
var isParsed;

export default class CLI {
    #object;
    #argv;
    #commands;

    #spec;
    #options;
    #arguments;

    static parse ( spec ) {
        if ( isParsed ) throw Error( `CLI is alreday parsed` );

        isParsed = true;

        return new this( spec );
    }

    static _findSpec ( object ) {
        if ( Object.isPlain( object ) ) {
            return object;
        }
        else {
            if ( object.cli && typeof object.cli === "function" ) {
                return object.cli();
            }
            else if ( object.constructor.cli && typeof object.constructor.cli === "function" ) {
                return object.constructor.cli();
            }
            else {
                return {};
            }
        }
    }

    constructor ( object, argv, commands ) {
        this.#spec = this._findSpec( object ) || {};

        // validate cli spec
        if ( !cliSpecValidator ) {
            cliSpecValidator = ajv().compile( fs.config.read( "#resources/schemas/cli.meta.schema.yaml", { "resolve": import.meta.url } ) );
        }

        // cle spec error
        if ( !cliSpecValidator( this.#spec ) ) {
            console.log( "CLI spec is not valid, inspect errors below:" );

            console.log( cliSpecValidator.errors );

            process.exit( 2 );
        }

        this.#commands = commands || [];

        this.#object = object;
        this.#argv = argv || process.argv.slice( 2 );

        // process commands
        if ( this.#spec.commands ) {
            this.#processCommands();
        }

        // process options
        else {
            this.#processOptions();
        }
    }

    // protected
    _findSpec ( object ) {
        return this.constructor._findSpec( object );
    }

    // private
    #processCommands () {
        var argv = this.#argv,
            spec = this.#spec;

        const command = argv.shift();

        if ( command == null || command === "" ) this.#printHelp();

        if ( command === "--help" || command === "-h" || command === "-?" ) this.#printHelp();

        if ( command === "--version" ) this.#printVersion();

        if ( command.charAt( 0 ) === "-" ) this.#throw( "Command is required." );

        const idx = {};

        // index short names
        for ( const commandName in spec.commands ) {
            if ( Array.isArray( spec.commands[commandName] ) ) {
                const shortCommandName = spec.commands[commandName][0];

                if ( idx[shortCommandName] ) this.#throw( `Command short name "${shortCommandName}" is not unique.` );

                idx[shortCommandName] = commandName;
            }
        }

        let possibleCommands = [];

        // match short name
        if ( idx[command] ) {
            possibleCommands.push( idx[command] );
        }

        // find matching commands
        else {
            for ( const commandName in spec.commands ) {

                // exact match
                if ( commandName === command ) {
                    possibleCommands = [command];

                    break;
                }

                // partial match
                if ( commandName.indexOf( command ) === 0 ) {
                    possibleCommands.push( commandName );
                }
            }
        }

        // command found
        if ( possibleCommands.length === 1 ) {
            this.#commands.push( possibleCommands[0] );

            if ( Array.isArray( spec.commands[possibleCommands[0]] ) ) {
                new CLI( spec.commands[possibleCommands[0]][1], argv, this.#commands );
            }
            else {
                new CLI( spec.commands[possibleCommands[0]], argv, this.#commands );
            }
        }

        // command not found
        else {

            // find help opton
            for ( const arg of argv ) {
                if ( arg === "--help" || arg === "-h" || arg === "-?" ) this.#printHelp();
            }

            // no matching commands
            if ( possibleCommands.length === 0 ) {
                this.#throw( `Command "${command}" is unknown.` );
            }

            // more than 1 matching command
            else {
                this.#throw( `Command "${command}" is ambiguous. Possible commands: ${possibleCommands.join( ", " )}.` );
            }
        }
    }

    #processOptions () {
        var argv = this.#argv;

        // prepare options
        this.#options = new Options( this.#spec.options );

        // prepare arguments
        this.#arguments = new Arguments( this.#spec.arguments );

        var errors = [];

        while ( argv.length > 0 ) {
            let arg = argv.shift();

            // stop parsing
            if ( arg === "--" ) {
                break;
            }

            // option
            else if ( arg.charAt( 0 ) === "-" && arg !== "-" ) {
                let value, hasArgument;

                // parse option argument
                const eqIndex = arg.indexOf( "=" );

                if ( eqIndex !== -1 ) {
                    value = arg.substring( eqIndex + 1 );
                    arg = arg.substring( 0, eqIndex );
                    hasArgument = true;
                }

                // long option
                if ( arg.startsWith( "--" ) ) {
                    let name = arg.substring( 2 );

                    // global options
                    if ( name === "help" ) this.#printHelp();
                    if ( name === "version" ) this.#printVersion();

                    let isNegated;

                    // negated boolean option
                    if ( name.startsWith( "no-" ) ) {
                        name = name.substring( 3 );

                        isNegated = true;
                    }

                    const option = this.#options.getOption( name );

                    // option is unknown
                    if ( !option ) {
                        errors.push( `Option "${name}" is unknown.` );

                        continue;
                    }

                    // boolean long option
                    if ( !option.requireArgument ) {

                        // boolean option can't have argument
                        if ( hasArgument ) {
                            errors.push( `Option "${name}" does not requires argument.` );

                            continue;
                        }

                        // negated option is not allowed
                        if ( isNegated && !option.allowNegated ) {
                            errors.push( `Option "--no-${name}" is not allowed.` );

                            continue;
                        }

                        // only negated option is allowed
                        else if ( !isNegated && option.negatedOnly ) {
                            errors.push( `Option "--${name}" is not allowed.` );

                            continue;
                        }

                        // set boolean option value
                        errors.push( ...option.setValue( isNegated ? false : true ) );
                    }

                    // not boolean long option
                    else {

                        // only boolean options can be negated
                        if ( isNegated ) {
                            errors.push( `Option "${name}" is unknown.` );

                            continue;
                        }

                        if ( !hasArgument ) {
                            value = argv.shift();

                            if ( value == null || value.charAt( 0 ) === "-" ) {
                                errors.push( `Option "${name}" requires argument.` );

                                continue;
                            }
                        }

                        errors.push( ...option.setValue( value ) );
                    }
                }

                // short option
                else {

                    // remove first "-"
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
                        if ( name === "?" || name === "h" ) this.#printHelp();

                        const option = this.#options.getOption( name );

                        // invalid option
                        if ( !option ) {
                            errors.push( `Option "${name}" is unknown.` );

                            continue;
                        }

                        // not last short option
                        if ( opts.length ) {

                            // boolean short option
                            if ( !option.requireArgument ) {

                                // set boolean option value
                                errors.push( ...option.setValue( option.negatedOnly ? false : true ) );

                                continue;
                            }

                            // non-boolean
                            else {

                                // set option value
                                errors.push( ...option.setValue( opts.join( "" ) ) );

                                break;
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

                                // set boolean option value
                                errors.push( ...option.setValue( option.negatedOnly ? false : true ) );
                            }
                            else {
                                if ( !hasArgument ) {
                                    value = argv.shift();

                                    if ( value == null || value.charAt( 0 ) === "-" ) {
                                        errors.push( `Option "${name}" requires argument.` );

                                        continue;
                                    }
                                }

                                // add option value
                                errors.push( ...option.setValue( value ) );
                            }
                        }
                    }
                }
            }

            // argument
            else {
                errors.push( ...this.#arguments.addValue( arg ) );
            }
        }

        // validate options
        errors.push( ...this.#options.validate() );

        // validate arguments
        errors.push( ...this.#arguments.validate() );

        if ( errors.length ) this.#throw( errors );

        process.cli = {};
        process.cli.options = this.#options.getValues();
        process.cli.arguments = this.#arguments.getValues();
        process.cli.argv = argv;

        if ( typeof this.#object === "function" ) {
            new this.#object().run();

            // process.exit( 0 );
        }
    }

    #throw ( errors ) {
        if ( !Array.isArray( errors ) ) errors = [errors];

        errors.forEach( e => console.log( "ERROR: " + e ) );

        console.log( `\nUse --help, -h or -? option to get help.` );

        process.exit( 2 );
    }

    #printHelp () {
        console.log( this.#spec.title + "\n" );

        if ( this.#spec.description ) console.log( this.#spec.description + "\n" );

        var usage = "Usage: " + path.basename( process.argv[1] );

        if ( this.#commands.length ) usage += " " + this.#commands.join( " " );

        if ( this.#spec.commands ) {
            usage += " <command>";

            console.log( usage + "\n" );

            console.log( this.#getHelpCommands() + "\n" );
        }
        else {
            usage += this.#options.getHelpUsage();

            usage += this.#arguments.getHelpUsage();

            console.log( usage + "\n" );

            if ( this.#options.getHelp() ) console.log( this.#options.getHelp() + "\n" );

            if ( this.#arguments.getHelp() ) console.log( this.#arguments.getHelp() + "\n" );
        }

        console.log( "Global options: --help, -h, -?, --version" );

        // exit process
        process.exit();
    }

    // XXX short options
    #getHelpCommands () {
        var commands = this.#spec.commands;

        console.log( "where <command> is one of:\n" );

        let maxLength = 0,
            hasShortNames;

        // index max command name length
        for ( const name in commands ) {
            if ( name.length > maxLength ) maxLength = name.length;

            if ( Array.isArray( commands[name] ) ) hasShortNames = true;
        }

        var help = [];

        for ( const name in commands ) {
            const shortName = Array.isArray( commands[name] ) ? commands[name][0] + ", " : "   ",
                spec = this._findSpec( Array.isArray( commands[name] ) ? commands[name][1] : commands[name] );

            if ( !spec ) {
                console.log( `Spec for command "${name}" not found.` );

                process.exit( 2 );
            }

            if ( hasShortNames ) {
                help.push( "  " + shortName + name.padEnd( maxLength, " " ) + " ".repeat( 6 ) + spec.title );
            }
            else {
                help.push( "  " + name.padEnd( maxLength, " " ) + " ".repeat( 6 ) + spec.title );
            }
        }

        return help.join( "\n" );
    }

    #printVersion () {
        const pkg = fs.config.read( env.root + "/package.json" );

        const version = [];

        if ( pkg.name ) version.push( pkg.name );
        if ( pkg.version ) version.push( pkg.version );

        if ( version.length ) {
            console.log( version.join( " " ) );

            process.exit( 0 );
        }
        else {
            console.log( `Package version is not specified.` );

            process.exit( 2 );
        }
    }
}
