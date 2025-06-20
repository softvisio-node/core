import Option from "#lib/cli/options/option";
import Table from "#lib/text/table";

export default class CliOptions {
    #global;
    #items = {};
    #shorts = {};
    #helpUsage;
    #help;

    constructor ( options, globalOptions ) {
        this.#global = !globalOptions;

        if ( !options ) return;

        for ( const name in options ) {
            if ( options[ name ] == null ) continue;

            const option = new Option( name, options[ name ] );

            this.#items[ name ] = option;

            if ( globalOptions?.getOption( name ) ) {
                this.#throwSpecError( `Option name "${ name }" is conflicted with the global options.` );
            }

            if ( option.short !== false ) {

                // short option name is already defined
                if ( this.#shorts[ option.short ] != null ) {
                    this.#throwSpecError( `Short option name "${ option.short }" is not unique.` );
                }
                else {
                    this.#shorts[ option.short ] = option;
                }

                if ( this.#shorts && globalOptions?.getOption( this.#shorts ) ) {
                    this.#throwSpecError( `Short option name "${ this.#shorts }" is conflicted with the global options.` );
                }
            }
        }

        // check conflicts
        for ( const name in options ) {
            if ( name.startsWith( "no-" ) ) {
                const option = this.#items[ name.slice( 3 ) ];

                if ( option?.allowNegated ) {
                    this.#throwSpecError( `Option "${ name }" is conflicted with the option "${ option.name }"` );
                }

                const globalOption = globalOptions?.getOption( name.slice( 3 ) );

                if ( globalOption?.allowNegated ) {
                    this.#throwSpecError( `Option "${ name }" is conflicted with the global option "${ globalOption.name }"` );
                }
            }
        }
    }

    // properties
    get isGlobal () {
        return this.#global;
    }

    // public
    getOption ( name ) {
        return this.#items[ name ] || this.#shorts[ name ];
    }

    validate () {
        var errors = [];

        for ( const name in this.#items ) {
            errors.push( ...this.#items[ name ].validate() );
        }

        return errors;
    }

    getValues () {
        var values = {};

        for ( const name in this.#items ) {
            values[ name ] = this.#items[ name ].value;
        }

        return values;
    }

    getHelpUsage () {
        if ( this.#helpUsage == null ) {
            var usage = [];

            for ( const name in this.#items ) {
                usage.push( this.#items[ name ].getHelpUsage() );
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
            for ( const name in this.#items ) {
                const length = this.#items[ name ].getHelpSpec().length;

                if ( length > maxLength ) maxLength = length;
            }

            if ( !maxLength ) {
                this.#help = "";
            }
            else {
                const table = new Table( {
                    "ansi": process.stdout.isTTY,
                    "width": process.stdout.columns,
                    "style": "borderless",
                    "header": false,
                    "columns": {
                        "spec": { "width": maxLength + 6, "margin": [ 2, 4 ] },
                        "desc": { "flex": 1 },
                    },
                } );

                for ( const name in this.#items ) {
                    const option = this.#items[ name ],
                        spec = option.getHelpSpec(),
                        desc = option.getHelpDescription();

                    table.add( { spec, desc } );
                }

                table.end();

                if ( this.#global ) {
                    this.#help = "global options:\n" + table.content;
                }
                else {
                    this.#help = "options:\n" + table.content;
                }
            }
        }

        return this.#help;
    }

    // private
    #throwSpecError ( error ) {
        console.log( error );

        process.exit( 2 );
    }
}
