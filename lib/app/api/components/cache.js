import Component from "#lib/app/api/component";
import sql from "#lib/sql";
import User from "#lib/app/api/auth/user";
import CacheLru from "#lib/cache/lru";

const QUERIES = {
    "getUserById": sql`
SELECT
    id,
    email,
    enabled,
    email_confirmed,
    locale,
    gravatar,
    telegram_username,
    telegram_user_id,
    ( SELECT hash FROM user_password_hash WHERE user_id = "user".id ) AS password_hash,
    ( SELECT get_user_notifications_profile( "user".id ) ) AS notifications
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
    gravatar,
    telegram_username,
    telegram_user_id,
    ( SELECT hash FROM user_password_hash WHERE user_id = "user".id ) AS password_hash,
    ( SELECT get_user_notifications_profile( "user".id ) ) AS notifications
FROM
    "user"
WHERE
    email = ?
`.prepare(),

    "getUserByTelegramUserId": sql`
SELECT
    id,
    email,
    enabled,
    email_confirmed,
    locale,
    gravatar,
    telegram_username,
    telegram_user_id,
    ( SELECT hash FROM user_password_hash WHERE user_id = "user".id ) AS password_hash,
    ( SELECT get_user_notifications_profile( "user".id ) ) AS notifications
FROM
    "user"
WHERE
    telegram_user_id = ?
`.prepare(),
};

export default class extends Component {
    #usersCache;
    #userEmailIndex = {};
    #userTelegramUserIdIndex = {};

    // public
    async getUserById ( userId, { dbh } = {} ) {
        const user = this.#getCachedUser( userId );

        // user is cached
        if ( user ) return user;

        dbh ||= this.dbh;

        const res = await dbh.selectRow( QUERIES.getUserById, [userId] );

        return this.#updateUser( res.data );
    }

    async getUserByEmail ( email, { dbh } = {} ) {
        const userId = this.#userEmailIndex[email];

        if ( userId ) return this.getUserById( userId );

        dbh ||= this.dbh;

        const res = await dbh.selectRow( QUERIES.getUserByEmail, [email] );

        return this.#updateUser( res.data );
    }

    async getUserByTelegramUserId ( telegramUserId, { dbh } = {} ) {
        const userId = this.#userTelegramUserIdIndex[telegramUserId];

        if ( userId ) return this.getUserById( userId );

        dbh ||= this.dbh;

        const res = await dbh.selectRow( QUERIES.getUserByTelegramUserId, [telegramUserId] );

        return this.#updateUser( res.data );
    }

    // protected
    async _init () {
        this.#usersCache = new CacheLru( { "maxSize": this.api.config.usersCacheMaxSize } ).on( "delete", this.#onDeleteUserFromCache.bind( this ) );

        this.dbh.on( "connect", this.#onBackendConnect.bind( this ) );

        this.dbh.on( "api/user/delete", this.#onUserDelete.bind( this ) );

        this.dbh.on( "api/user/update", this.#onUserUpdate.bind( this ) );
        this.dbh.on( "api/user-password-hash/update", this.#onUserUpdate.bind( this ) );
        this.dbh.on( "api/user-notifications/update", this.#onUserUpdate.bind( this ) );

        return result( 200 );
    }

    // private
    // XXX how to update connected users on backend connected
    #onBackendConnect () {}

    // XXX get active connected user
    #getCachedUser ( userId ) {
        var user = this.#usersCache.get( userId );

        return user;
    }

    // XXX check if user connected, restore in cache
    #onDeleteUserFromCache ( userId, user ) {
        delete this.#userEmailIndex[user.email];

        if ( user.telegramUserId ) delete this.#userTelegramUserIdIndex[user.telegramUserId];
    }

    // XXX close connections
    #onUserDelete ( data ) {
        const user = this.#getCachedUser( data.id );

        if ( !user ) return;

        // delete user from cache
        this.#usersCache.delete( user.id );
    }

    #onUserUpdate ( data ) {
        const user = this.#getCachedUser( data.id );

        // user is not cached
        if ( !user ) return;

        this.#updateUser( data, user );
    }

    // XXX close connections on user email changed
    #updateUser ( data, user ) {
        if ( !data ) return;

        // get user from cache
        user ||= this.#getCachedUser( data.id );

        // user is not cached
        if ( !user ) {
            user = new User( this.api, data );

            this.#cacheUser( user );
        }

        // user is cached
        else {
            if ( "email" in data ) {

                // user email was changed
                if ( user.email !== data.email ) {
                    delete this.#userEmailIndex[user.email];
                }
            }

            if ( "telegram_user_id" in data ) {

                // telegram user id was changed
                if ( user.telegramUserId !== data.telegram_user_id ) {
                    delete this.#userTelegramUserIdIndex[user.telegramUserId];
                }
            }

            user.update( data );

            this.#cacheUser( user );
        }

        return user;
    }

    #cacheUser ( user ) {
        this.#usersCache.set( user.id, user );

        this.#userEmailIndex[user.email] = user.id;

        if ( user.telegramUserId ) this.#userTelegramUserIdIndex[user.telegramUserId] = user.id;
    }
}
