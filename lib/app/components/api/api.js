import Base from "#lib/app/api/base";
import constants from "#lib/app/constants";
import Argon2 from "#lib/argon2";

import Validate from "#lib/app/api/components/validate";
import Cache from "#lib/app/api/components/cache";
import Acl from "#lib/app/api/components/acl";
import Health from "#lib/app/api/components/health";
import User from "#lib/app/api/components/user";
import UserActionTokens from "#lib/app/api/components/user-action-tokens";
import UserSessions from "#lib/app/api/components/user-sessions";
import UserTokens from "#lib/app/api/components/user-tokens";
import Notifications from "#lib/app/api/components/notifications";
import Frontend from "#lib/app/api/frontend";

const COMPONENTS = {
    "validate": Validate,
    "cache": Cache,
    "acl": Acl,
    "health": Health,
    "user": User,
    "userActionTokens": UserActionTokens,
    "userSessions": UserSessions,
    "userTokens": UserTokens,
    "notifications": Notifications,
    "frontend": Frontend,
};

export default class AppApi extends Base {
    #dbh;
    #argon2;

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

    get httpServer () {
        return this.app.publicHttpServer;
    }

    get isConnected () {
        return this.dbh.isConnected;
    }

    get argon2 () {
        return this.#argon2;
    }

    // public
    async waitConnect () {
        return this.dbh.waitConnect();
    }

    // protected
    async _init () {
        var res;

        // setup events
        this.dbh.on( "connect", () => this.emit( "connect" ) );
        this.dbh.on( "disconnect", () => this.emit( "disconnect" ) );

        // migrate database
        res = await this.dbh.schema.migrate( new URL( "db", import.meta.url ) );
        if ( !res.ok ) return res;

        // init argon2
        this.#argon2 = new Argon2( this.config.argon2 );

        return result( 200 );
    }

    async _postInit () {
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

        res = await this.user.createUser(
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
        if ( process.cli?.options["reset-root"] ) {
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
                res = await this.user.setUserPassword( constants.rootUserId, rootPassword );

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

            process.exit( exitCode );
        }

        if ( res.ok || res.status === 409 ) {
            return result( 200 );
        }
        else {
            return res;
        }
    }
}
