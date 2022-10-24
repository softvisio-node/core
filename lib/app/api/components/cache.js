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
    ( SELECT get_user_notifications( "user".id ) ) AS notifications
FROM
    "user"
WHERE
    id = ?
`.prepare(),
};

export default class extends Component {
    #usersCache;
    #userEmailIndex = {};
    #userTelegramUserIdIndex = {};

    // public
    async getUserById ( userId, { dbh } = {} ) {
        if ( !userId ) return new User( this.api );

        var user = this.#getCachedUser( userId );

        // user is cached
        if ( user ) return user;

        dbh ||= this.dbh;

        const res = await dbh.selectRow( QUERIES.getUserById, [userId] );

        // user not found
        if ( !res.data ) {
            this.#usersCache.delete( userId );

            return new User( this.api );
        }

        user = this.#usersCache.get( userId );

        // update cached user
        if ( user ) {
            user.update( res.data );
        }

        // create and cache user
        else {
            user = new User( this.api, res.data );

            this.#cacheUser( user );
        }

        return user;
    }

    async getUserByEmail ( email, { dbh } = {} ) {
        const userId = this.#userEmailIndex[email];

        if ( !userId ) return;

        return this.getUserById( userId, { dbh } );
    }

    async getUserByTelegramUserId ( telegramUserId, { dbh } = {} ) {
        const userId = this.#userTelegramUserIdIndex[telegramUserId];

        if ( !userId ) return;

        return this.getUserById( userId, { dbh } );
    }

    // protected
    async _init () {
        this.#usersCache = new CacheLru( { "maxSize": this.api.config.usersCacheMaxSize } ).on( "delete", this.#onDeleteUserFromCache.bind( this ) );

        this.dbh.on( "api/user/update", this.#onUserUpdate.bind( this ) );

        this.dbh.on( "api/user-password-hash/update", this.#onUserPasswordHashUpdate.bind( this ) );

        this.dbh.on( "api/user-notifications/update", this.#onUserNotificationsUpdate.bind( this ) );

        this.dbh.on( "api/user/delete", this.#onUserDelete.bind( this ) );

        return result( 200 );
    }

    // private
    #getCachedUser ( userId ) {
        var user = this.#usersCache.get( userId );

        return user;
    }

    #cacheUser ( user ) {
        this.#usersCache.set( user.id, user );

        this.#userEmailIndex[user.email] = user.id;
        if ( user.telegramUsername ) this.#userTelegramUserIdIndex[user.telegramUsername] = user.id;
    }

    #onDeleteUserFromCache ( userId, user ) {
        delete this.#userEmailIndex[user.email];

        if ( user.telegramUsername ) delete this.#userTelegramUserIdIndex[user.telegramUsername];
    }

    // XXX
    #onUserUpdate ( data ) {
        const user = this.#getCachedUser( data.id );

        if ( !user ) return;

        user.update( data );
    }

    #onUserPasswordHashUpdate ( data ) {
        const user = this.#getCachedUser( data.id );

        if ( !user ) return;

        user.update( data );
    }

    #onUserNotificationsUpdate ( data ) {
        const user = this.#getCachedUser( data.id );

        if ( !user ) return;

        user.update( data );
    }

    // XXX
    #onUserDelete ( data ) {}
}
