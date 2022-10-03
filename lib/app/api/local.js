import mixins from "#lib/mixins";
import constants from "#lib/app/constants";
import * as utils from "#lib/utils";

import UserRoles from "./local/user-roles.js";
import User from "./local/user.js";
import UserActionTokens from "./local/user-action-tokens.js";
import AclMixin from "./local/acl.js";
import UserSessions from "./local/user-sessions.js";
import UserTokens from "./local/user-tokens.js";
import ApiCallLog from "./local/api-call-log.js";
import HealthCheck from "./local/health-check.js";
import ApiSchema from "./local/schema.js";

export default Super =>
    class extends mixins( ApiSchema, UserRoles, User, UserActionTokens, AclMixin, UserSessions, UserTokens, ApiCallLog, HealthCheck, Super ) {
        #dbh;

        constructor () {
            super();

            this.#dbh = this.app.dbh;
        }

        // properties
        get dbh () {
            return this.#dbh;
        }

        get isConnected () {
            return this.#dbh.isConnected;
        }

        // public
        async waitConnect () {
            return this.#dbh.waitConnect();
        }

        async authenticate ( token ) {
            if ( token.type === constants.tokenTypeUserToken ) {
                return this._authenticateUserToken( token );
            }
            else if ( token.type === constants.tokenTypeUserSession ) {
                return this._authenticateUserSession( token );
            }
            else {
                return;
            }
        }

        // protected
        async _init ( options = {} ) {
            var res;

            // init db
            process.stdout.write( "Migrating API database schema ... " );
            if ( this.#dbh.isPgsql ) {
                res = await this.#dbh.schema.migrate( new URL( "local/db", import.meta.url ) );
            }
            else {
                res = result( [500, `Only PostgreSQL is supported`] );
            }
            console.log( res + "" );
            if ( !res.ok ) return res;

            // init app components
            res = await this.app._initComponents();
            if ( !res.ok ) return res;

            // setup events
            this.#dbh.on( "connect", () => this.app.publish( "backend/connect" ) );
            this.#dbh.on( "disconnect", () => this.app.publish( "backend/disconnect" ) );

            // migrate db schema
            if ( options.dbSchema ) {
                process.stdout.write( "Migrating application database schema ... " );
                res = await this.#dbh.schema.migrate( options.dbSchema );
                console.log( res + "" );
                if ( !res.ok ) return res;
            }

            // run threads
            process.stdout.write( "Starting argon2 thread ... " );
            res = await this.app.threads.run( {
                "argon2": {
                    "num": 1,
                    "path": utils.resolve( "./local/threads/argon2.js", import.meta.url ),
                },
            } );
            console.log( res + "" );
            if ( !res.ok ) return res;

            // create root user
            let rootPassword;

            // root password is defined in env
            if ( process.env.APP_ROOT_PASSWORD ) rootPassword = process.env.APP_ROOT_PASSWORD;

            process.stdout.write( "Creating root user ... " );
            res = await this.createUser(
                process.env.APP_ROOT_EMAIL,
                {
                    "password": rootPassword,
                    "telegram_username": process.env.APP_ROOT_TELEGRAM_USERNAME,
                },
                { "root": true }
            );

            console.log( res + ( res.ok ? ", password" + ( !rootPassword ? `: ${res.data.password}` : " taken from environment" ) : "" ) );

            // error creating root user
            if ( !res.ok ) {

                // error
                if ( res.status !== 409 ) {
                    return res;
                }

                // root user already exists, change root password
                else if ( process.cli?.options["reset-root"] ) {
                    process.stdout.write( "Setting root password ... " );
                    res = await this.setUserPassword( constants.rootUserId, rootPassword );
                    console.log( res + ( res.ok ? ", password" + ( !rootPassword ? `: ${res.data.password}` : " taken from environment" ) : "" ) );
                    process.exit( 0 );
                }
            }

            res = super._init ? await super._init( options ) : result( 200 );
            if ( !res.ok ) return res;

            res = await this._initApiObjects();

            return res;
        }
    };
