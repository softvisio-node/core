import Component from "#lib/app/api/component";
import sql from "#lib/sql";
import User from "#lib/app/api/user";
import CacheLru from "#lib/cache/lru";
import Token from "#lib/app/api/token";
import constants from "#lib/app/constants";
import Mutex from "#core/threads/mutex";

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

    // XXX
    "getUserTokenById": sql`
SELECT
    user_session.id,
    user_session.user_id,
    user_session.expires,
    user_session.last_authorized,
    user_session_hash.fingerprint,
    user_session_hash.hash
FROM
    user_session,
    user_session_hash
WHERE
    user_session.id =  user_session_hash.user_session_id
    AND user_session.id = ?
`.prepare(),

    "getUserSessionTokenById": sql`
SELECT
    user_session.id,
    user_session.user_id,
    user_session.expires,
    user_session.last_authorized,
    user_session_hash.fingerprint,
    user_session_hash.hash
FROM
    user_session,
    user_session_hash
WHERE
    user_session.id =  user_session_hash.user_session_id
    AND user_session.id = ?
`.prepare(),
};

export default class extends Component {
    #mutexSet = new Mutex.Set( { "destroyOnFinish": true } );
    #usersCache;
    #userEmailIndex = {};
    #userTelegramUserIdIndex = {};
    #userTokensCache;
    #userSessionTokensCache;

    // public
    async getUserById ( userId, { dbh } = {} ) {
        var user = this.#usersCache.get( userId );

        // user is cached
        if ( user ) return user;

        const mutex = this.#mutexSet.get( `user/id/${userId}` );
        if ( !mutex.tryDown() ) return mutex.signal.wait();

        dbh ||= this.dbh;

        const res = await dbh.selectRow( QUERIES.getUserById, [userId] );

        user = this.#updateUser( res.data );

        mutex.signal.broadcast( user );
        mutex.up();

        return user;
    }

    async getUserByEmail ( email, { dbh } = {} ) {
        const userId = this.#userEmailIndex[email];

        if ( userId ) return this.getUserById( userId );

        const mutex = this.#mutexSet.get( `user/email/${email}` );
        if ( !mutex.tryDown() ) return mutex.signal.wait();

        dbh ||= this.dbh;

        const res = await dbh.selectRow( QUERIES.getUserByEmail, [email] );

        const user = this.#updateUser( res.data );

        mutex.signal.broadcast( user );
        mutex.up();

        return user;
    }

    async getUserByTelegramUserId ( telegramUserId, { dbh } = {} ) {
        const userId = this.#userTelegramUserIdIndex[telegramUserId];

        if ( userId ) return this.getUserById( userId );

        const mutex = this.#mutexSet.get( `user/telegramUserId/${telegramUserId}` );
        if ( !mutex.tryDown() ) return mutex.signal.wait();

        dbh ||= this.dbh;

        const res = await dbh.selectRow( QUERIES.getUserByTelegramUserId, [telegramUserId] );

        const user = this.#updateUser( res.data );

        mutex.signal.broadcast( user );
        mutex.up();

        return user;
    }

    async getUserTokenById ( tokenId, { dbh } = {} ) {
        var token = this.#userTokensCache.get( tokenId );

        if ( token ) return token;

        const mutex = this.#mutexSet.get( `token/${tokenId}` );
        if ( !mutex.tryDown() ) return mutex.signal.wait();

        dbh ||= this.dbh;

        const res = await dbh.selectRow( QUERIES.getUserTokenById, [tokenId] );

        if ( res.data ) {
            res.data.type = constants.tokenTypeUserToken;

            token = this.#userTokensCache.get( tokenId );

            if ( token ) {
                token.update( res.data );
            }
            else {
                token = new Token( this.api, res.data );

                this.#userTokensCache.set( token.id, token );
            }
        }

        mutex.signal.broadcast( token );
        mutex.up();

        return token;
    }

    async getUserSessionTokenById ( tokenId, { dbh } = {} ) {
        var token = this.#userSessionTokensCache.get( tokenId );

        if ( token ) return token;

        const mutex = this.#mutexSet.get( `session/${tokenId}` );
        if ( !mutex.tryDown() ) return mutex.signal.wait();

        dbh ||= this.dbh;

        const res = await dbh.selectRow( QUERIES.getUserSessionTokenById, [tokenId] );

        if ( res.data ) {
            res.data.type = constants.tokenTypeUserSession;
            res.data.enabled = true;

            token = this.#userSessionTokensCache.get( tokenId );

            if ( token ) {
                token.update( res.data );
            }
            else {
                token = new Token( this.api, res.data );

                this.#userSessionTokensCache.set( token.id, token );
            }
        }

        mutex.signal.broadcast( token );
        mutex.up();

        return token;
    }

    // protected
    // XXX token update events
    async _init () {
        this.#usersCache = new CacheLru( { "maxSize": this.api.config.usersCacheMaxSize } ).on( "delete", this.#onDeleteUserFromCache.bind( this ) );

        this.#userTokensCache = new CacheLru( { "maxSize": this.api.config.userTokensCacheMaxSize } );

        this.#userSessionTokensCache = new CacheLru( { "maxSize": this.api.config.userSessionsCacheMaxSize } );

        this.dbh.on( "disconnect", this.#onBackendDisconnect.bind( this ) );

        this.dbh.on( "api/user/delete", this.#onUserDelete.bind( this ) );

        this.dbh.on( "api/user/update", this.#onUserUpdate.bind( this ) );
        this.dbh.on( "api/user-password-hash/update", this.#onUserUpdate.bind( this ) );
        this.dbh.on( "api/user-notifications/update", this.#onUserUpdate.bind( this ) );

        return result( 200 );
    }

    // private
    #onBackendDisconnect () {
        this.#userEmailIndex = {};
        this.#userTelegramUserIdIndex = {};
        this.#usersCache.clear( { "silent": true } );

        this.#userTokensCache.clear( { "silent": true } );

        this.#userSessionTokensCache.clear( { "silent": true } );
    }

    #onDeleteUserFromCache ( userId, user ) {
        delete this.#userEmailIndex[user.email];

        if ( user.telegramUserId ) delete this.#userTelegramUserIdIndex[user.telegramUserId];
    }

    #onUserDelete ( data ) {
        this.#usersCache.delete( data.id );
    }

    #onUserUpdate ( data ) {
        if ( !this.#usersCache.has( data.id ) ) return;

        this.#updateUser( data );
    }

    #updateUser ( data ) {
        if ( !data ) return;

        // get user from cache
        var user = this.#usersCache.get( data.id );

        // user is not cached
        if ( !user ) {
            user = new User( this.api, data );

            this.#usersCache.set( user.id, user );

            this.#userEmailIndex[user.email] = user.id;

            if ( user.telegramUserId ) this.#userTelegramUserIdIndex[user.telegramUserId] = user.id;
        }

        // user is cached
        else {
            if ( "email" in data ) {

                // user email was changed
                if ( user.email !== data.email ) {
                    delete this.#userEmailIndex[user.email];
                    this.#userEmailIndex[data.email] = user.id;
                }
            }

            if ( "telegram_user_id" in data ) {

                // telegram user id was changed
                if ( user.telegramUserId !== data.telegram_user_id ) {
                    delete this.#userTelegramUserIdIndex[user.telegramUserId];
                    if ( data.telegram_user_id ) this.#userTelegramUserIdIndex[data.telegram_user_id] = user.id;
                }
            }

            user.update( data );
        }

        return user;
    }
}
