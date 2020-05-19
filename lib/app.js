const { mix } = require( "./mixins" );
const cli = require( "./cli" );
const Server = require( "./server" );
const EventEmitter = require( "events" );
const Api = require( "./app/api" );
const Router = require( "./app/router" );
const Auth = require( "./app/auth" );

module.exports = class extends mix( Router, Auth ) {
    devel = false;

    #emitter = null;
    #server = null;
    #api = null;

    static runCli () {
        var spec = this.cli ? this.cli() : {};

        spec.options.devel = {
            "summary": "run app in development mode",
            "default": false,
            "schema": {
                "type": "boolean",
            },
        };

        cli( spec );
    }

    constructor ( options ) {
        if ( !options ) options = {};

        super( options );

        if ( process.cli ) {
            if ( process.cli.options.devel ) this.devel = process.cli.options.devel;

            if ( options.devel ) this.devel = options.devel;
        }
    }

    getApi () {
        return this.#api;
    }

    async run () {
        this.#emitter = new EventEmitter();

        this.#api = new Api( this );
        await this.initApi( this.#api );

        this.#server = new Server( {} );
        await this.initServer( this.#server );

        this.#server.listen( "0.0.0.0", 80, ( socket ) => {
            console.log( "Listening ..." );
        } );
    }
};
