const fs = require( "../fs" );
const result = require( "../result" );
const Auth = require( "./auth" );

class Api {
    app;
    auth;

    #methods = {};

    static getAuthClass ( auth ) {

        // auth is not defined
        if ( !auth ) {
            return Auth( require( "./auth/loopback" ) );
        }

        // auth is url
        else if ( typeof auth === "string" ) {
            const url = new URL( auth ),
                protocol = url.protocol.slice( 0, -1 );

            if ( protocol === "sqlite" ) {
                return Auth( require( "./auth/sqlite" ) );
            }
            else if ( protocol === "pgsql" ) {
                return Auth( require( "./auth/pgsql" ) );
            }
            else if ( protocol === "ws" || protocol === "wss" ) {
                return Auth( require( "./auth/remote" ) );
            }
            else {
                throw `Invalid auth url "${auth}"`;
            }
        }

        // auth is dbh
        else {
            if ( auth.isSqlite ) {
                return Auth( require( "./auth/sqlite" ) );
            }
            else if ( auth.isPgsql ) {
                return Auth( require( "./auth/pgsql" ) );
            }
            else {
                throw "Auth object is not dbh";
            }
        }
    }

    constructor ( app ) {
        this.app = app;
    }

    // TODO
    async init ( options ) {

        // create and init auth
        const Auth = this.constructor.getAuthClass( options.auth );

        this.auth = new Auth( this.app, options.auth );

        const res = await this.auth.init();

        if ( !res.isOk() ) return res;

        // load api methods
        await this._loadMethods( options.methods.path );
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
        return this.auth.authenticate( token );
    }

    async authenticatePrivate ( privateToken ) {
        return this.auth.authenticatePrivate( privateToken );
    }
}

module.exports = Api;
