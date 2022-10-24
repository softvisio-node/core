import Component from "#lib/app/api/component";
import sql from "#lib/sql";
import User from "#lib/app/api/auth/user";
import CacheLru from "#lib/cache/lru";

const QUERIES = {
    "getUserById": sql`
SELECT
    "user".id,
    "user".email,
    "user".enabled,
    "user".locale,
    "user".gravatar,
    "user".telegram_username,
    ( SELECT id FROM telegram_user WHERE name = "user".telegram_username ) AS telegram_user_id,
    ( SELECT hash FROM user_password_hash WHERE user_id = "user".id ) AS password_hash,
    ( SELECT json_object_agg(
        type, json_build_object(
            'internal', internal,
            'email', email,
            'telegram', telegram,
            'push', push
        ) ) FROM user_notification_type WHERE user_id = "user".id ) AS notifications
FROM
    "user"
WHERE
    id = ?
`.prepare(),
};

export default class extends Component {
    #usersCache;
    #userEmailIndex = {};

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

            this.#usersCache.set( userId, user );
        }

        return user;
    }

    async getUserByEmail ( email, { dbh } = {} ) {
        const userId = this.#userEmailIndex[email];

        if ( !userId ) return;

        return this.getUserById( userId, { dbh } );
    }

    // protected
    async _init () {
        this.#usersCache = new CacheLru( { "maxSize": this.api.config.usersCacheMaxSize } );

        this.dbh.on( "api/user/update", this.#onUserUpdate.bind( this ) );

        this.dbh.on( "api/user/delete", this.#onUserDelete.bind( this ) );

        return result( 200 );
    }

    // private
    #getCachedUser ( userId ) {
        var user = this.#usersCache.get( userId );

        return user;
    }

    #onUserUpdate ( data ) {
        const user = this.#getCachedUser( data.user_id );

        if ( !user ) return;

        user.update( data );
    }

    #onUserDelete ( data ) {}
}
