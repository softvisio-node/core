import Commands from "#lib/cli/commands";
import Options from "#lib/cli/options";
import Arguments from "#lib/cli/arguments";
import path from "path";
import Ajv from "#lib/ajv";
import env from "#lib/env";
import { objectIsPlain } from "#lib/utils";
import { readConfig } from "#lib/config";

var cliSchema;
var isParsed;

export default class CLI {
    #object;
    #argv;
    #commandsStack;

    #spec;
    #globalOptions = {};
    #commands;
    #options;
    #arguments;

    constructor ( object, argv, commandsStack, commandTitle ) {
        this.#spec = this.#findSpec( object ) || {};

        if ( commandTitle ) this.#spec.title = commandTitle;

        // validate cli spec
        cliSchema ??= new Ajv().addSchema( readConfig( "#resources/schemas/cli.schema.yaml", { "resolve": import.meta.url } ) );

        // cle spec error
        if ( !cliSchema.validate( "config", this.#spec ) ) {
            console.log( `CLI config is not valid, inspect errors below:\n${cliSchema.errors}` );

            process.exit( 2 );
        }

        this.#commandsStack = commandsStack || [];

        this.#object = object;

        this.#argv = argv || process.argv.slice( 2 );
    }

    // static
    static async parse ( spec ) {
        if ( isParsed ) throw Error( `CLI is alreday parsed` );

        isParsed = true;

        const cli = new this( spec );

        return cli.parse();
    }

    // public
    async parse () {

        // process commands
        if ( this.#spec.commands ) {
            return await this.#processCommands();
        }

        // process options
        else {
            return await this.#processOptions();
        }
    }

    // private
    #findSpec ( object ) {
        if ( objectIsPlain( object ) ) {
            return object;
        }
        else {
            if ( object.cli && typeof object.cli === "function" ) {
                return object.cli();
            }
            else if ( object.constructor.cli && typeof object.constructor.cli === "function" ) {
                return object.constructor.cli();
            }
        }
    }

    #parseGlobalOptions () {
        const argv = [];

        for ( const arg of this.#argv ) {
            if ( arg === "--help" || arg === "-h" ) {
                this.#globalOptions["help"] = true;
            }
            else if ( arg === "--version" ) {
                this.#globalOptions["version"] = true;
            }
            else {
                argv.push( arg );
            }
        }

        this.#argv = argv;
    }

    async #processCommands () {
        this.#commands = new Commands( this.#spec.commands );

        var command;

        // find command
        for ( let n = 0; n < this.#argv.length; n++ ) {
            if ( this.#argv[n].startsWith( "-" ) ) continue;

            command = this.#argv[n];

            this.#argv.splice( n, 1 );

            break;
        }

        // command not provided
        if ( !command ) {

            // find global options
            for ( const arg of this.#argv ) {
                if ( arg === "--help" || arg === "-h" || command === "-?" ) this.#printHelp();

                if ( arg === "--version" ) this.#printVersion();
            }

            this.#printHelp();
        }

        const possibleCommands = this.#commands.getCommand( command );

        // command not found
        if ( Array.isArray( possibleCommands ) ) {

            // find help opton
            for ( const arg of this.#argv ) {
                if ( arg === "--help" || arg === "-h" || arg === "-?" ) this.#printHelp();
            }

            // no matching commands
            if ( !possibleCommands.length ) {
                this.#throw( `Command "${command}" is unknown.` );
            }

            // more than 1 matching command
            else {
                this.#throw( `Command "${command}" is ambiguous. Possible commands: ${possibleCommands.join( ", " )}.` );
            }
        }

        // command found
        else {
            this.#commandsStack.push( possibleCommands.name );

            const module = await possibleCommands.getModule();

            const cli = new this.constructor( module, this.#argv, this.#commandsStack, possibleCommands.title );

            return cli.parse();
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
                        errors.push( ...option.addValue( isNegated ? false : true ) );
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

                        errors.push( ...option.addValue( value ) );
                    }
                }

                // short option
                else {

                    // remove first "-"
                    arg = arg.substring( 1 );

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
                                errors.push( ...option.addValue( option.negatedOnly ? false : true ) );

                                continue;
                            }

                            // non-boolean
                            else {

                                // set option value
                                errors.push( ...option.addValue( opts.join( "" ) ) );

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
                                errors.push( ...option.addValue( option.negatedOnly ? false : true ) );
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
                                errors.push( ...option.addValue( value ) );
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
        process.cli.command = "/" + this.#commandsStack.join( "/" );
        process.cli.options = this.#options.getValues();
        process.cli.arguments = this.#arguments.getValues();
        process.cli.argv = argv;

        return this.#object;
    }

    #throw ( errors ) {
        if ( !Array.isArray( errors ) ) errors = [errors];

        errors.forEach( e => console.log( "ERROR: " + e ) );

        console.log( `\nUse --help, -h or -? option to get help.` );

        process.exit( 2 );
    }

    #printHelp () {
        console.log( this.#spec.title + "\n" );

        if ( this.#spec.description ) console.log( this.#spec.description.replaceAll( /^/gm, " ".repeat( 4 ) ) + "\n" );

        var usage = "usage: " + path.basename( process.argv[1] );

        if ( this.#commandsStack.length ) usage += " " + this.#commandsStack.join( " " );

        if ( this.#commands ) {
            usage += " <command>";

            console.log( usage + "\n" );

            console.log( this.#commands.getHelp() + "\n" );
        }
        else {
            usage += this.#options.getHelpUsage();

            usage += this.#arguments.getHelpUsage();

            console.log( usage + "\n" );

            if ( this.#options.getHelp() ) console.log( this.#options.getHelp() );

            if ( this.#arguments.getHelp() ) console.log( this.#arguments.getHelp() );
        }

        console.log( "global options: --help, -h, -?, --version" );

        // exit process
        process.exit( 0 );
    }

    #printVersion () {
        const pkg = env.package;

        const version = [];

        if ( pkg.name ) version.push( pkg.name );
        if ( pkg.version ) version.push( "v" + pkg.version );

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
