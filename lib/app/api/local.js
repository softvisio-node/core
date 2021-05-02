import "#index";

import mixins from "#lib/mixins";
import sql from "#lib/sql";
import fs from "#lib/fs";
import { ROOT_USER_NAME, AUTH_USER, AUTH_TOKEN, AUTH_SESSION } from "#lib/const";

import UserPermissions from "./local/user-permissions.js";
import User from "./local/user.js";
import UserActionToken from "./local/user-action-token.js";
import ObjectMixin from "./local/object.js";
import UserSession from "./local/user-session.js";
import UserToken from "./local/user-token.js";
import Settings from "./local/settings.js";
import ApiCallLog from "./local/api-call-log.js";

export default Super =>
    class extends mixins( UserPermissions, User, UserActionToken, ObjectMixin, UserSession, UserToken, Settings, ApiCallLog, Super ) {
        #dbh;

        constructor ( dbh ) {
            if ( typeof dbh === "string" ) dbh = sql.connect( dbh );

            super( dbh );

            this.#dbh = dbh;
        }

        // GETTER
        get dbh () {
            return this.#dbh;
        }

        // PUBLIC
        async $init ( options = {} ) {

            // init db
            process.stdout.write( "Migrating API backend schema ... " );
            await this.#dbh.loadSchema( new URL( "local/db/" + ( this.#dbh.isSqlite ? "sqlite" : "pgsql" ), import.meta.url ), "api" );
            let res = await this.#dbh.migrate();
            console.log( res + "" );
            if ( !res.ok ) return res;

            // migrate db schema
            if ( options.schema ) {
                process.stdout.write( "Migrating DB schema ... " );
                await this.#dbh.loadSchema( options.schema );
                res = await this.#dbh.migrate();
                console.log( res + "" );
                if ( !res.ok ) return res;
            }

            // run threads
            process.stdout.write( "Starting argon2 thread ... " );
            res = await this.app.threads.run( {
                "argon2": {
                    "num": 1,
                    "path": fs.resolve( "./local/threads/argon2.js", import.meta.url ),
                },
            } );
            console.log( res + "" );
            if ( !res.ok ) return res;

            // create root user
            let password;

            if ( this.app.env.root ) {

                // root password is defined in env
                if ( this.app.env.root.password != null && this.app.env.root.password !== "" ) password = this.app.env.root.password;

                delete this.app.env.root.password;
            }

            process.stdout.write( "Creating root user ... " );
            res = await this.createUser( ROOT_USER_NAME, password, true, null, this.app.env.root );
            console.log( res + ( res.ok ? ", password" + ( password == null ? `: ${res.data.password}` : ' taken from ".env" file' ) : "" ) );

            // error creating root user
            if ( !res.ok ) {

                // error
                if ( res.status !== 409 ) {
                    return res;
                }

                // root user already exists
                else if ( process.cli.options["reset-root"] ) {
                    process.stdout.write( "Setting root password ... " );
                    res = await this.setUserPassword( ROOT_USER_NAME, password );
                    console.log( res + ( res.ok ? ", password" + ( password == null ? `: ${res.data.password}` : ' taken from ".env" file' ) : "" ) );
                    process.exit();
                }
            }

            res = super.$init ? await super.$init( options ) : result( 200 );

            return res;
        }

        // PROTECTED
        async authenticate ( token ) {
            if ( token.type === AUTH_USER ) {
                return this._authenticateUserPassword( token );
            }
            else if ( token.type === AUTH_TOKEN ) {
                return this._authenticateUserToken( token );
            }
            else if ( token.type === AUTH_SESSION ) {
                return this._authenticateUserSession( token );
            }
            else {
                return;
            }
        }
    };
