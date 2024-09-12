import Command from "#lib/cli/commands/command";

export default class CliCommands {
    #items = {};
    #short = {};
    #hasShortNames;

    constructor ( spec ) {
        if ( !spec ) return;

        for ( const name in spec ) {

            // skip undefined command
            if ( !spec[ name ] ) continue;

            const command = new Command( name, spec[ name ] );

            this.#items[ name ] = command;

            if ( command.short ) {
                this.#hasShortNames = true;

                // short option name is already defined
                if ( this.#short[ command.short ] != null ) {
                    this.#throwSpecError( `Short command name "${ command.short }" is not unique.` );
                }
                else {
                    this.#short[ command.short ] = command;
                }
            }
        }
    }

    // public
    getCommand ( command ) {

        // match short name
        if ( this.#short[ command ] ) {
            return this.#short[ command ];
        }

        // full name exact match
        else if ( this.#items[ command ] ) {
            return this.#items[ command ];
        }

        // find matching commands
        else {
            const possibleCommands = [];

            for ( const commandName in this.#items ) {

                // partial match
                if ( commandName.indexOf( command ) === 0 ) {
                    possibleCommands.push( commandName );
                }
            }

            if ( possibleCommands.length === 1 ) {
                return this.#items[ possibleCommands ];
            }
            else {
                return possibleCommands;
            }
        }
    }

    getHelp () {
        const commands = this.#items;

        var maxLength = 0;

        // index max command name length
        for ( const name in commands ) {
            if ( name.length > maxLength ) maxLength = name.length;
        }

        var help = [];

        for ( const command of Object.values( commands ) ) {
            if ( this.#hasShortNames ) {
                help.push( "  " + ( command.short
                    ? command.short + ", "
                    : "   " ) + command.name.padEnd( maxLength, " " ) + " ".repeat( 4 ) + command.title );
            }
            else {
                help.push( "  " + command.name.padEnd( maxLength, " " ) + " ".repeat( 4 ) + command.title );
            }
        }

        return "where <command> is one of:\n\n" + help.join( "\n" );
    }

    // private
    #throwSpecError ( error ) {
        console.log( error );

        process.exit( 2 );
    }
}
