import sql from "#lib/sql";
import User from "#lib/app/user";
import CacheLru from "#lib/cache/lru";
import Mutex from "#lib/threads/mutex";
import Events from "#lib/events";
import constants from "#lib/app/constants";
import passwords from "#lib/passwords";
import { validateEmail, validatePassword } from "#lib/validate";

const SQL = {
    "getUserById": sql`
SELECT
    id,
    email,
    enabled,
    email_confirmed,
    locale,
    ( SELECT hash FROM user_password_hash WHERE user_id = "user".id ) AS password_hash,
    get_user_notifications( "user".id ) AS notifications
FROM
    "user"
WHERE
    id = ?
`.prepare(),

    "getUserByEmail": sql`
SELECT
    id,
    email,
    enabled,
    email_confirmed,
    locale,
    ( SELECT hash FROM user_password_hash WHERE user_id = "user".id ) AS password_hash,
    get_user_notifications( "user".id ) AS notifications
FROM
    "user"
WHERE
    email = ?
`.prepare(),

    "getUsersById": sql`
SELECT
    id,
    email,
    enabled,
    email_confirmed,
    locale,
    ( SELECT hash FROM user_password_hash WHERE user_id = "user".id ) AS password_hash,
    get_user_notifications( "user".id ) AS notifications
FROM
    "user"
WHERE
    id IN ( SELECT json_array_elements_text( ? )::int8 )
`.prepare(),

    "upsertPasswordHash": sql`INSERT INTO user_password_hash ( user_id, hash ) VALUES ( ?, ? ) ON CONFLICT ( user_id ) DO UPDATE SET hash = EXCLUDED.hash`.prepare(),

    "setUserEnabled": sql`UPDATE "user" SET enabled = ? WHERE id = ? AND enabled = ?`.prepare(),

    "setUserLocale": sql`UPDATE "user" SET locale = ? WHERE id = ?`.prepare(),
};

export default class Users extends Events {
    #app;
    #config;
    #mutexSet = new Mutex.Set();
    #usersCache;
    #userEmailIndex = {};

    constructor ( app, config ) {
        super();

        this.#app = app;
        this.#config = config;

        this.#usersCache = new CacheLru( { "maxSize": config.cacheMaxSize } ).on( "delete", this.#onDeleteUserFromCache.bind( this ) );
    }

    // properties
    get app () {
        return this.#app;
    }

    get config () {
        return this.#config;
    }

    get dbh () {
        return this.#app.dbh;
    }

    // public
    async init () {
        var res;

        // migrate database
        res = await this.dbh.schema.migrate( new URL( "db", import.meta.url ) );
        if ( !res.ok ) return res;

        this.dbh.on( "disconnect", this.#onBackendDisconnect.bind( this ) );

        this.dbh.on( "users/user/delete", this.#onUserDelete.bind( this ) );
        this.dbh.on( "users/user/update", this.#onUserUpdate.bind( this ) );
        this.dbh.on( "users/user-password-hash/update", this.#onUserUpdate.bind( this ) );
        this.dbh.on( "users/user-notification/update", this.#onUserUpdate.bind( this ) );

        return result( 200 );
    }

    getCachedUserById ( userId ) {
        return this.#usersCache.get( userId );
    }

    async getUserById ( userId, { dbh } = {} ) {
        var user = this.#usersCache.get( userId );

        // user is cached
        if ( user ) return user;

        const mutex = this.#mutexSet.get( `user/id/${userId}` );
        if ( !mutex.tryLock() ) return mutex.wait();

        dbh ||= this.dbh;

        const res = await dbh.selectRow( SQL.getUserById, [userId] );

        if ( res.ok ) {
            user = this.#updateUser( res.data );
        }
        else {
            user = false;
        }

        mutex.unlock( user );

        return user;
    }

    async getUserByEmail ( email, { dbh } = {} ) {
        const userId = this.#userEmailIndex[email];

        if ( userId ) return this.getUserById( userId );

        const mutex = this.#mutexSet.get( `user/email/${email}` );
        if ( !mutex.tryLock() ) return mutex.wait();

        dbh ||= this.dbh;

        const res = await dbh.selectRow( SQL.getUserByEmail, [email] );

        var user;

        if ( res.ok ) {
            user = this.#updateUser( res.data );
        }
        else {
            user = false;
        }

        mutex.unlock( user );

        return user;
    }

    async getUsers ( users ) {
        const data = [],
            select = [];

        for ( const id of users ) {
            if ( id instanceof User ) {
                data.push( id );
            }
            else {
                const user = this.getCachedUserById( id );

                if ( user ) {
                    data.push( user );
                }
                else {
                    select.push( id );
                }
            }
        }

        if ( select.length ) {
            const res = await this.dbh.select( SQL.getUsersById, [select] );

            if ( !res.ok ) return;

            if ( res.data ) {
                for ( const row of res.data ) {
                    const user = new User( this.app, row );

                    data.push( user );
                }
            }
        }

        return data;
    }

    validatePassword ( value ) {
        return validatePassword( value, { "strength": this.config.passwordsStrength } );
    }

    generateRandomPassword () {
        return passwords.generatePassword().password;
    }

    async createUser ( email, { password, enabled, locale, emailConfirmed, root, dbh } = {} ) {
        dbh ||= this.dbh;

        // check email
        if ( !this.app.emailIsFake( email ) ) {

            // lowercase email
            email = email.toLowerCase();

            // validate email
            const emailIsValid = validateEmail( email );
            if ( !emailIsValid.ok ) return emailIsValid;
        }

        // generate password, if password is empty
        if ( !password ) {
            password = this.generateRandomPassword();
        }

        // validate password
        else {
            const res = this.validatePassword( password );

            if ( !res.ok ) return res;
        }

        const fields = {
            email,
            "email_confirmed": emailConfirmed ?? false,
            "enabled": false,
        };

        if ( root ) {
            fields.id = constants.rootUserId;
            enabled = true;
        }
        else {
            enabled ??= this.config.newUserEnabledByDefault;
        }

        // validate locale
        if ( !this.app.locales.has( locale ) ) {
            fields.locale = locale;
        }

        // generate password hash
        const passwordHash = await this.app.argon2.createHash( password );

        // start transaction
        const user = await dbh.begin( async dbh => {
            let res = await dbh.selectRow( sql`INSERT INTO "user"`.VALUES( fields ).sql`ON CONFLICT DO NOTHING RETURNING id` );

            if ( !res.ok ) throw res;

            // user already exists
            if ( !res.data ) return result( [409, "User already exists"] );

            const userId = res.data.id;

            // insert user password hash
            res = await dbh.do( SQL.upsertPasswordHash, [userId, passwordHash] );

            // unable to insert user hash
            if ( !res.ok ) throw res;

            // enable user
            if ( enabled ) {
                res = await dbh.do( SQL.setUserEnabled, [true, userId, false] );
                if ( !res.ok ) throw res;
            }

            const user = result( 200, {
                "id": userId,
                email,
                password,
                enabled,
            } );

            return user;
        } );

        return user;
    }

    async setUserPassword ( userId, password, { dbh } = {} ) {
        dbh ||= this.dbh;

        // generate password, if password is empty
        if ( !password ) {
            password = passwords.generatePassword().password;
        }

        // validate password
        else {
            const res = this.app.users.validatePassword( password );

            if ( !res.ok ) return res;
        }

        const user = await this.app.users.getUserById( userId, { dbh } );

        if ( !user ) return result( [404, `User not found`] );

        // generate password hash
        const passwordHash = await this.app.argon2.createHash( password );

        const res = await dbh.do( SQL.upsertPasswordHash, [user.id, passwordHash] );

        if ( !res.ok ) {
            return res;
        }
        else if ( res.meta.rows ) {
            return result( 200, { password } );
        }
        else {
            return result( [500, "Unable to update user authentication hash"] );
        }
    }

    async setUserEnabled ( userId, enabled, { dbh } = {} ) {
        dbh ||= this.dbh;

        if ( this.app.userIsRoot( userId ) ) return result( [400, "Unable to modify root user"] );

        const user = await this.app.users.getUserById( userId, { dbh } );

        if ( !user ) return result( [404, `User not found`] );

        const res = await dbh.do( SQL.setUserEnabled, [enabled, user.id, !enabled] );

        if ( !res.ok ) {
            return res;
        }
        else if ( res.meta.rows ) {
            user.updateFields( { "enabled": !!enabled } );

            return res;
        }
        else {
            return result( 204 );
        }
    }

    async setUserLocale ( userId, locale, { dbh } = {} ) {
        if ( !this.app.locales.has( locale ) ) return result( [400, `Locale is not valid`] );

        dbh ||= this.dbh;

        return dbh.do( SQL.setUserLocale, [locale, userId] );
    }

    // private
    #onBackendDisconnect () {
        this.#userEmailIndex = {};
        this.#usersCache.clear( { "silent": true } );
    }

    #onDeleteUserFromCache ( userId, user ) {
        delete this.#userEmailIndex[user.email];
    }

    #onUserDelete ( data ) {
        this.#usersCache.delete( data.id );
    }

    #onUserUpdate ( data ) {
        if ( !this.#usersCache.has( data.id ) ) return;

        this.#updateUser( data );
    }

    #updateUser ( fields ) {
        if ( !fields ) return;

        // get user from cache
        var user = this.#usersCache.get( fields.id );

        // user is cached
        if ( user ) {
            if ( "email" in fields ) {

                // user email was changed
                if ( user.email !== fields.email ) {
                    delete this.#userEmailIndex[user.email];
                    this.#userEmailIndex[fields.email] = user.id;
                }
            }

            user.updateFields( fields );
        }

        // user is not cached
        else {
            user = new User( this.app, fields );

            this.#usersCache.set( user.id, user );

            this.#userEmailIndex[user.email] = user.id;
        }

        return user;
    }
}
