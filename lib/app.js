const Cli = require( "./cli.js" );

module.exports = class extends require( "./base.js" ) {
    cli = null;

    constructor () {
        super();

        // cli
        if ( typeof this.CLI === "function" ) {
            const spec = this.CLI(),
                cli = new Cli(),
                options = cli.parse( process.argv.slice( 2 ), spec );

            this.cli = options;
        }
    }
};
