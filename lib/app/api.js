const fs = require( "../fs" );
const result = require( "../result" );
const AuthDescriptor = require( "./auth-descriptor" );

class Api {
    app;
    auth;

    #methods;

    constructor ( app ) {
        this.app = app;
    }

    // TODO
    async init ( options ) {

        // create and init auth
        var Auth;

        if ( !options.auth ) {
            Auth = require( "./auth/loopback" );
        }
        else if ( typeof options.auth === "string" ) {
            const url = new URL( options.auth ),
                protocol = url.protocol.slice( 0, -1 );

            if ( protocol === "sqlite" ) {
                Auth = require( "./auth/sqlite" );
            }
            else if ( protocol === "pgsql" ) {
                Auth = require( "./auth/pgsql" );
            }
            else if ( protocol === "ws" || protocol === "wss" ) {
                Auth = require( "./auth/remote" );
            }
            else {
                throw "Invalid auth";
            }
        }
        else {
            if ( options.auth.isSqlite ) {
                Auth = require( "./auth/sqlite" );
            }
            else if ( options.auth.isPgsql ) {
                Auth = require( "./auth/pgsql" );
            }
            else {
                throw "Invalid auth";
            }
        }

        this.auth = new Auth( this.app, options.auth );

        const res = await this.auth.init();

        if ( !res.isOk() ) return res;

        // load api methods
        await this._loadMethods();
    }

    // TODO load / parse spec
    async _loadMethods ( path ) {
        const files = await fs.readTree( path );

        for ( const file of files ) {
            const version = file.substr( 0, file.indexOf( "/" ) );

            const name = file.substr( version.length + 1 ).slice( 0, -3 );

            const Class = require( path + "/" + file );

            const object = new Class( {
                "app": this.app,
            } );

            // TODO scan methods
            this.#methods["/" + version + "/" + name + "/" + "test"] = {
                version,
                "path": name,
                "name": "/" + version + "/" + name + "/" + "test",
                "codeName": "API_test",
                object,
                "groups": {
                    "admin": true,
                    "users": false,
                },
            };
        }

        return result( 200 );
    }

    getMethod ( id ) {
        return this.#methods[id];
    }

    // AUTHENTICATE
    async authenticate ( token ) {
        if ( !token ) {
            return new AuthDescriptor( this );
        }
        else {
            return this.auth.authenticate( token );
        }
    }
}

module.exports = Api;
