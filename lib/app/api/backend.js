import constants from "#lib/app/constants";
import Acl from "#lib/app/api/backend/components/acl";
import ApiCallLog from "#lib/app/api/backend/components/api-call-log";
import HealthCheck from "#lib/app/api/backend/components/health-check";
import User from "#lib/app/api/backend/components/user";
import UserActionTokens from "#lib/app/api/backend/components/user-action-tokens";
import UserRoles from "#lib/app/api/backend/components/user-roles";
import UserSessions from "#lib/app/api/backend/components/user-sessions";
import UserTokens from "#lib/app/api/backend/components/user-tokens";

export default class {
    #api;
    #acl;
    #apiCallLog;
    #healthCheck;
    #user;
    #userActionTokens;
    #userRoles;
    #userSessions;
    #userTokens;

    constructor ( api ) {
        this.#api = api;
    }

    // properties
    get app () {
        return this.#api.app;
    }

    get api () {
        return this.#api;
    }

    get dbh () {
        return this.#api.app.dbh;
    }

    get config () {
        return this.#api.config;
    }

    get acl () {
        return this.#acl;
    }

    get apiCallLog () {
        return this.#apiCallLog;
    }

    get healthCheck () {
        return this.#healthCheck;
    }

    get user () {
        return this.#user;
    }

    get userActionTokens () {
        return this.#userActionTokens;
    }

    get userRoles () {
        return this.#userRoles;
    }

    get userSessions () {
        return this.#userSessions;
    }

    get userTokens () {
        return this.#userTokens;
    }

    // public
    async init () {
        var res;

        // migrate database
        res = await this.dbh.schema.migrate( new URL( "backend/db", import.meta.url ) );
        if ( !res.ok ) return res;

        // run threads
        res = await this.app.threads.run( {
            "argon2": {
                "num": 1,
                "module": new URL( "backend/threads/argon2.js", import.meta.url ),
            },
        } );
        if ( !res.ok ) return res;

        // create
        this.#acl = new Acl( this );
        this.#apiCallLog = new ApiCallLog( this );
        this.#healthCheck = new HealthCheck( this );
        this.#user = new User( this );
        this.#userActionTokens = new UserActionTokens( this );
        this.#userRoles = new UserRoles( this );
        this.#userSessions = new UserSessions( this );
        this.#userTokens = new UserTokens( this );

        // init
        res = await this.#acl.init();
        if ( !res.ok ) return res;

        res = await this.#apiCallLog.init();
        if ( !res.ok ) return res;

        res = await this.#healthCheck.init();
        if ( !res.ok ) return res;

        res = await this.#user.init();
        if ( !res.ok ) return res;

        res = await this.#userRoles.init();
        if ( !res.ok ) return res;

        res = await this.#userActionTokens.init();
        if ( !res.ok ) return res;

        res = await this.#userSessions.init();
        if ( !res.ok ) return res;

        res = await this.#userTokens.init();
        if ( !res.ok ) return res;

        // create root user
        res = await this.#createRootUser();
        if ( !res.ok ) return res;

        return result( 200 );
    }

    // XXX
    async authenticate ( token ) {}

    // private
    async #createRootUser () {
        var res;

        const rootPassword = this.config.root.password;

        res = await this.user.createUser(
            this.config.root.email,
            {
                "password": rootPassword,
                "telegram_username": this.config.root.telegramUsername,
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

        // error creating root user
        else {

            // error
            if ( res.status !== 409 ) {
                return res;
            }

            // root user already exists, change root password
            else if ( process.cli?.options["reset-root"] ) {
                res = await this.user.setUserPassword( constants.rootUserId, rootPassword );

                if ( res.ok ) {
                    if ( rootPassword ) {
                        console.log( `Root user password was setted from the configuration` );
                    }
                    else {
                        console.log( `Root user password was setted to: ${res.data.password}` );
                    }
                }
                else {
                    console.log( `Error set root passworrd: ` + res );
                }

                process.exit( 0 );
            }
        }

        return result( 200 );
    }
}
