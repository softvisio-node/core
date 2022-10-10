import Events from "#lib/events";
import constants from "#lib/app/constants";
import Auth from "#lib/app/api/auth";
import Token from "#lib/app/api/auth/token";
import Signal from "#lib/threads/signal";

import Acl from "#lib/app/api/backend/components/acl";
import ApiCallLog from "#lib/app/api/backend/components/api-call-log";
import HealthCheck from "#lib/app/api/backend/components/health-check";
import User from "#lib/app/api/backend/components/user";
import UserActionTokens from "#lib/app/api/backend/components/user-action-tokens";
import UserRoles from "#lib/app/api/backend/components/user-roles";
import UserSessions from "#lib/app/api/backend/components/user-sessions";
import UserTokens from "#lib/app/api/backend/components/user-tokens";

export default class extends Events {
    #api;
    #startedAuth = {};

    #acl;
    #apiCallLog;
    #healthCheck;
    #user;
    #userActionTokens;
    #userRoles;
    #userSessions;
    #userTokens;

    constructor ( api ) {
        super();

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

    get isConnected () {
        return this.dbh.isConnected;
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

        // setup events
        this.dbh.on( "connect", () => this.emit( "connect" ) );
        this.dbh.on( "disconnect", () => this.emit( "disconnect" ) );

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

    async waitConnect () {
        return this.dbh.waitConnect();
    }

    // XXX
    async authenticate ( token ) {

        // backend is down
        if ( !this.isConnected ) return;

        var auth;

        // no token provided
        if ( !token ) return new Auth( this.#api );

        // parse token
        token = Token.new( token );

        // token is corrupted
        if ( !token.isValid ) return new Auth( this.#api, token );

        var user;

        if ( token.isUserToken ) {
            user = await this.userTokens.authenticate( token );
        }
        else if ( token.isUserSessionToken ) {
            user = await this.userSessions.authenticate( token );
        }

        return new Auth( this.#api, token, user );

        // XXX ----------------------------------------------------------------------
        /* eslint-disable no-unreachable */

        // get auth from cache by token id or user name
        auth = this.authCache.get( token );

        // auth is cached
        if ( auth ) {

            // cached auth is match provided token
            if ( auth.token.hash === token.hash ) {
                return auth;
            }

            // cached auth is not match provided token
            else {
                return new Auth( this, token );
            }
        }

        // auth is not cached
        else {

            // authentication is already started
            if ( this.#startedAuth[token.cacheId] ) return ( this.#startedAuth[token.cacheId].signal ??= new Signal() ).wait();

            // start suthentication
            this.#startedAuth[token.cacheId] = {};

            // perform authentication on backend
            const userData = await super.authenticate( token );

            // authenticated
            if ( userData ) {
                auth = new Auth( this, token, userData );

                // add to the cache, if authenticated
                this.authCache.add( auth );
            }

            // not authenticated
            else {
                auth = new Auth( this, token );
            }

            const signal = this.#startedAuth[token.cacheId].signal;

            delete this.#startedAuth[token.cacheId];

            if ( signal ) signal.broadcast( auth );

            return auth;
        }

        /* eslint-enable no-unreachable */
    }

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
