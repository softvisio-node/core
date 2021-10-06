import mixins from "#lib/mixins";
import sql from "#lib/sql";
import CONST from "#lib/const";
import * as utils from "#lib/utils";

import UserPermissions from "./local/user-permissions.js";
import User from "./local/user.js";
import UserActionToken from "./local/user-action-token.js";
import ObjectMixin from "./local/object.js";
import UserSession from "./local/user-session.js";
import UserToken from "./local/user-token.js";
import ApiCallLog from "./local/api-call-log.js";
import HealthCheck from "./local/health-check.js";
import ApiSchema from "./local/schema.js";

export default Super =>
    class extends mixins( UserPermissions, User, UserActionToken, ObjectMixin, UserSession, UserToken, ApiCallLog, HealthCheck, ApiSchema, Super ) {
        #dbh;

        constructor ( dbh ) {
            if ( typeof dbh === "string" ) dbh = sql.new( dbh );

            super( dbh );

            this.#dbh = dbh;
        }

        // properties
        get dbh () {
            return this.#dbh;
        }

        get isReady () {
            return this.#dbh.isReady;
        }

        // public
        async waitReady () {
            return this.#dbh.waitReady();
        }

        async authenticate ( token ) {
            if ( token.type === CONST.AUTH_USER ) {
                return this._authenticateUserPassword( token );
            }
            else if ( token.type === CONST.AUTH_TOKEN ) {
                return this._authenticateUserToken( token );
            }
            else if ( token.type === CONST.AUTH_SESSION ) {
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
            process.stdout.write( "Migrating API backend schema ... " );
            if ( this.#dbh.isPgSql ) {

                // setup events
                this.#dbh.on( "ready", () => this.emit( "ready" ) );
                this.#dbh.on( "disconnect", () => this.emit( "disconnect" ) );

                await this.#dbh.loadSchema( new URL( "local/db", import.meta.url ) );
                res = await this.#dbh.migrate();
            }
            else {
                res = result( [500, `Only PostgreSQL is supported`] );
            }
            console.log( res + "" );
            if ( !res.ok ) return res;

            // migrate db schema
            if ( options.dbSchema ) {
                process.stdout.write( "Migrating DB schema ... " );
                await this.#dbh.loadSchema( options.dbSchema );
                res = await this.#dbh.migrate();
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
            let password;

            // root password is defined in env
            if ( process.env.APP_ROOT_PASSWORD !== "" ) password = process.env.APP_ROOT_PASSWORD;

            process.stdout.write( "Creating root user ... " );
            res = await this.createUser( CONST.ROOT_USER_NAME, password, true, null, { "email": process.env.APP_ROOT_EMAIL } );
            console.log( res + ( res.ok ? ", password" + ( password == null ? `: ${res.data.password}` : " taken from environment" ) : "" ) );

            // error creating root user
            if ( !res.ok ) {

                // error
                if ( res.status !== 409 ) {
                    return res;
                }

                // root user already exists
                else if ( process.cli?.options["reset-root"] ) {
                    process.stdout.write( "Setting root password ... " );
                    res = await this.setUserPassword( CONST.ROOT_USER_NAME, password );
                    console.log( res + ( res.ok ? ", password" + ( password == null ? `: ${res.data.password}` : " taken from environment" ) : "" ) );
                    process.exit( 0 );
                }
            }

            res = super._init ? await super._init( options ) : result( 200 );

            return res;
        }
    };
