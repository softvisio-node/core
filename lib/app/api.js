const fs = require( "../fs" );
const result = require( "../result" );
const { ROOT_USER_NAME, ROOT_USER_ID } = require( "../const" );
const Auth = require( "./auth" );

class Api {
    app;
    auth;
    #methods;

    constructor ( app ) {
        this.app = app;
    }

    // TODO
    async init ( options ) {

        // create and init auth backend
        var Auth;

        if ( !options.auth ) {
            Auth = require( "./backend/loopback" );
        }
        else if ( typeof options.auth === "string" ) {
            const url = new URL( options.auth ),
                protocol = url.protocol.slice( 0, -1 );

            if ( protocol === "sqlite" ) {
                Auth = require( "./backend/sqlite" );
            }
            else if ( protocol === "pgsql" ) {
                Auth = require( "./backend/pgsql" );
            }
            else if ( protocol === "ws" || protocol === "wss" ) {
                Auth = require( "./backend/remote" );
            }
            else {
                throw "Invalid backend";
            }
        }
        else {
            if ( options.auth.isSqlite ) {
                Auth = require( "./backend/sqlite" );
            }
            else if ( options.auth.isPgsql ) {
                Auth = require( "./backend/pgsql" );
            }
            else {
                throw "Invalid backend";
            }
        }

        this.auth = new Auth( this.app, this, options.auth );

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
            return new Auth( this );
        }
        else {
            return this.auth.authenticate( token );
        }
    }

    // VALIDATORS
    userIsRoot ( userId ) {
        return userId === ROOT_USER_NAME || userId === ROOT_USER_ID;
    }

    validatePassword ( password ) {
        if ( password.length < 1 ) return result( [400, "Password must contain at least 1 character"] );

        result( 200 );
    }

    // accepted characters: A-z (case-insensitive), 0-9, "_", "-", "@", ".", length: 3-32 characters, not number, not UUID
    validateUsername ( username ) {

        // check length
        if ( username.length < 3 || username.length > 32 ) return result( [400, "Username length must be between 3 and 32 characters"] );

        // contains forbidden chars
        if ( /[^a-z\d_@.-]/i.test( username ) ) return result( [400, `Username must contain letters, digits, "_", "@", ".", "-" characters only`] );

        // digits only
        if ( /^\d+$/.test( username ) ) return result( [400, "Username should not contain digits only"] );

        // looks like uuid
        if ( /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test( username ) ) return result( [400, "Username should not look like UUID"] );

        return result( 200 );
    }

    // accepted characters: A-z (case-insensitive), 0-9 and underscores, length: 5-32 characters
    validateTelegramUsername ( username ) {

        // check length
        if ( username.length < 5 || username.length > 32 ) return result( [400, "Telegram username length must be between 5 and 32 characters"] );

        // contains forbidden chars
        if ( /[^a-z\d_]/i.test( username ) ) return result( [400, `Telegram username must contain letters, digits and "_" only`] );

        return result( 200 );
    }

    validateEmail ( email ) {
        if ( /^[a-z\d][a-z\d._-]+[a-z\d]@[a-z\d.-]+$/i.test( email ) ) return result( [400, "Email is invalid"] );

        return result( 200 );
    }
}

module.exports = Api;
