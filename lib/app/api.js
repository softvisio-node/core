import Events from "#lib/events";
import Frontend from "#lib/app/api/frontend";
import constants from "#lib/app/constants";
import Argon2 from "#lib/argon2";

import Validate from "#lib/app/api/components/validate";
import Cache from "#lib/app/api/components/cache";
import Acl from "#lib/app/api/components/acl";
import Stats from "#lib/app/api/components/stats";
import HealthCheck from "#lib/app/api/components/health-check";
import User from "#lib/app/api/components/user";
import UserActionTokens from "#lib/app/api/components/user-action-tokens";
import UserRoles from "#lib/app/api/components/user-roles";
import UserSessions from "#lib/app/api/components/user-sessions";
import UserTokens from "#lib/app/api/components/user-tokens";
import Notifications from "#lib/app/api/components/notifications";

export default class AppApi extends Events {
    #app;
    #config;
    #dbh;
    #argon2;
    #frontend;

    // components
    #validate;
    #cache;
    #acl;
    #stats;
    #healthCheck;
    #user;
    #userActionTokens;
    #userRoles;
    #userSessions;
    #userTokens;
    #notifications;

    constructor ( app, config ) {
        super();

        this.#app = app;
        this.#config = config;
        this.#dbh = app.dbh;
    }

    // properties
    get isApi () {
        return true;
    }

    get app () {
        return this.#app;
    }

    get config () {
        return this.#config;
    }

    get dbh () {
        return this.#dbh;
    }

    get httpServer () {
        return this.#app.publicHttpServer;
    }

    get isConnected () {
        return this.dbh.isConnected;
    }

    get argon2 () {
        return this.#argon2;
    }

    get frontend () {
        return this.#frontend;
    }

    // components
    get validate () {
        return this.#validate;
    }

    get cache () {
        return this.#cache;
    }

    get acl () {
        return this.#acl;
    }

    get stats () {
        return this.#stats;
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

    get notifications () {
        return this.#notifications;
    }

    // public
    async init () {
        var res;

        // setup events
        this.dbh.on( "connect", () => this.emit( "connect" ) );
        this.dbh.on( "disconnect", () => this.emit( "disconnect" ) );

        // migrate database
        res = await this.dbh.schema.migrate( new URL( "api/db", import.meta.url ) );
        if ( !res.ok ) return res;

        // init argon2
        this.#argon2 = new Argon2( this.config.argon2 );

        // create components
        this.#validate = new Validate( this );
        this.#cache = new Cache( this );
        this.#acl = new Acl( this );
        this.#stats = new Stats( this );
        this.#healthCheck = new HealthCheck( this );
        this.#user = new User( this );
        this.#userActionTokens = new UserActionTokens( this );
        this.#userRoles = new UserRoles( this );
        this.#userSessions = new UserSessions( this );
        this.#userTokens = new UserTokens( this );
        this.#notifications = new Notifications( this );

        // init components
        res = await this.#validate.init();
        if ( !res.ok ) return res;

        res = await this.#cache.init();
        if ( !res.ok ) return res;

        res = await this.#acl.init();
        if ( !res.ok ) return res;

        res = await this.#stats.init();
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

        res = await this.#notifications.init();
        if ( !res.ok ) return res;

        // init root user
        res = await this.#initRootUser();
        if ( !res.ok ) return res;

        // frontend
        this.#frontend = new Frontend( this );
        res = await this.#frontend.init();
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async run () {
        var res;

        res = await this.notifications.run();
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async waitConnect () {
        return this.dbh.waitConnect();
    }

    // private
    async #initRootUser () {
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
