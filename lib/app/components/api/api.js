import Api from "#lib/app/api";
import constants from "#lib/app/constants";

import Acl from "#lib/app/api/components/acl";
import Users from "#lib/app/api/components/users";
import Sessions from "#lib/app/api/components/sessions";
import Tokens from "#lib/app/api/components/tokens";
import Frontend from "#lib/app/api/frontend";

const COMPONENTS = {
    "acl": Acl,
    "users": Users,
    "sessions": Sessions,
    "tokens": Tokens,
    "frontend": Frontend,
};

export default class AppApi extends Api {
    #dbh;

    constructor ( app, config ) {
        super( app, config, COMPONENTS );

        this.#dbh = app.dbh;
    }

    // properties
    get isApi () {
        return true;
    }

    get dbh () {
        return this.#dbh;
    }

    get isConnected () {
        return this.dbh.isConnected;
    }

    get httpServer () {
        return this.app.publicHttpServer;
    }

    // public
    async waitConnect ( signal ) {
        return this.dbh.waitConnect( signal );
    }

    // protected
    async _init () {
        var res;

        // migrate database
        res = await this.dbh.schema.migrate( new URL( "db", import.meta.url ) );
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async _afterInit () {
        var res;

        // init root user
        res = await this.#initRootUser();
        if ( !res.ok ) return res;

        return result( 200 );
    }

    // private
    async #initRootUser () {
        var res;

        const rootPassword = this.config.root.password;

        res = await this.users.createUser(
            this.config.root.email,
            {
                "password": rootPassword,
            },
            { "root": true }
        );

        // root user created
        if ( res.ok ) {
            if ( rootPassword ) {
                console.log( `Root user password was setted from the configuration` );
            }
            else {
                console.log( `Root user password was setted to: ${res.data.password}` );
            }
        }

        // reset root user
        if ( process.cli?.command === "/reset-root-password" ) {
            let exitCode;

            if ( res.ok ) {
                exitCode = 0;
            }

            // error
            else if ( res.status !== 409 ) {
                console.log( `Error creating root user:`, res + "" );

                exitCode = 1;
            }

            // root user already exists
            else {

                // set root user password
                res = await this.users.setUserPassword( constants.rootUserId, rootPassword );

                if ( res.ok ) {
                    if ( rootPassword ) {
                        console.log( `Root user password was setted from the configuration` );
                    }
                    else {
                        console.log( `Root user password was setted to: ${res.data.password}` );
                    }

                    exitCode = 0;
                }
                else {
                    console.log( `Error set root user passworrd: ` + res );

                    exitCode = 1;
                }
            }

            process.shutDown( { "code": exitCode } );
        }

        if ( res.ok || res.status === 409 ) {
            return result( 200 );
        }
        else {
            return res;
        }
    }
}
