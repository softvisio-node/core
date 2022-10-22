import mixins from "#lib/mixins";
import Read from "#lib/app/mixins/read";
import sql from "#lib/sql";

const QUERIES = {
    "setReadAll": sql`UPDATE user_internal_notification SET read = TRUE WHERE user_id = ?`.prepare(),
    "setUnreadAll": sql`UPDATE user_internal_notification SET read = FALSE WHERE user_id = ?`.prepare(),
    "setDoneAll": sql`UPDATE user_internal_notification SET done = TRUE WHERE user_id = ?`.prepare(),
    "setUndoneAll": sql`UPDATE user_internal_notification SET done = FALSE WHERE user_id = ?`.prepare(),
    "deleteAll": sql`DELETE FROM user_internal_notification WHERE user_id = ?`.prepare(),
    "getStats": sql`
SELECT
    count( nullif( done, TRUE ) )::int4 AS total_undone,
    count( CASE WHEN ( done = FALSE AND read = FALSE ) THEN TRUE ELSE NULL END )::int4 AS total_undone_unread
FROM
    user_internal_notification
wHERE user_id = ?`.prepare(),
};

export default Super =>
    class extends mixins( Read, Super ) {
        async API_getNotificationsSettings ( ctx ) {
            const profile = await this.api.notifications.getUserNotificationsProfileByUserId( ctx.user.id );

            if ( !profile ) return result( 500 );

            const data = [];

            for ( const type in profile.notifications ) {
                const channel = profile.notifications[type];

                data.push( {
                    "user_id": profile.userId,
                    type,
                    "name": this.api.config.notifications.types[type].name,
                    "description": this.api.config.notifications.types[type].description,
                    "internal": channel.internal,
                    "email": channel.email,
                    "telegram": channel.telegram,
                    "push": channel.push,
                } );
            }

            return result( 200, data );
        }

        async API_setUserNotificationChannel ( ctx, type, channel, enabled ) {
            const insertValues = {
                "user_id": ctx.user.id,
                type,
                [channel]: enabled,
            };

            const updateValues = {
                [channel]: enabled,
            };

            const res = await this.dbh.do( sql`INSERT INTO user_notification_type`.VALUES( insertValues ).sql`ON CONFLICT ( user_id, type ) DO UPDATE`.SET( updateValues ) );

            return res;
        }

        async API_read ( ctx, options = {} ) {
            var where = this.dbh.where( sql`user_internal_notification.user_id = ${ctx.user.id} AND internal_notification.id = user_internal_notification.notification_id AND ( internal_notification.expires IS NULL OR internal_notification.expires > CURRENT_TIMESTAMP )` );

            // filter search
            if ( options.where?.done != null ) {
                where.and( { "user_internal_notification.done": options.where.done } );
            }

            const summaryQuery = sql`
SELECT
    count(*)::int4 AS total,
    count( nullif( user_internal_notification.read, TRUE ) )::int4 AS total_undone_unread
FROM
    internal_notification, user_internal_notification
`.WHERE( where );

            const mainQuery = sql`SELECT internal_notification.*, user_internal_notification.done, user_internal_notification.read FROM internal_notification, user_internal_notification`.WHERE( where );

            return this._read( ctx, mainQuery, { options, summaryQuery } );
        }

        async API_setRead ( ctx, notifications ) {
            const res = await this.dbh.do( sql`UPDATE user_internal_notification SET read = TRUE WHERE user_id = ${ctx.user.id} AND notification_id`.IN( notifications ) );

            res.meta.stats = await this.#getStats( ctx.user.id );

            return res;
        }

        async API_setReadAll ( ctx ) {
            const res = await this.dbh.do( QUERIES.setReadAll, [ctx.user.id] );

            res.meta.stats = await this.#getStats( ctx.user.id );

            return res;
        }

        async API_setUnread ( ctx, notifications ) {
            const res = await this.dbh.do( sql`UPDATE user_internal_notification SET read = FALSE WHERE user_id = ${ctx.user.id} AND notification_id`.IN( notifications ) );

            res.meta.stats = await this.#getStats( ctx.user.id );

            return res;
        }

        async API_setUnreadAll ( ctx ) {
            const res = await this.dbh.do( QUERIES.setUnreadAll, [ctx.user.id] );

            res.meta.stats = await this.#getStats( ctx.user.id );

            return res;
        }

        async API_setDone ( ctx, notifications ) {
            const res = await this.dbh.do( sql`UPDATE user_internal_notification SET done = TRUE WHERE user_id = ${ctx.user.id} AND notification_id`.IN( notifications ) );

            res.meta.stats = await this.#getStats( ctx.user.id );

            return res;
        }

        async API_setDoneAll ( ctx ) {
            const res = await this.dbh.do( QUERIES.setDoneAll, [ctx.user.id] );

            res.meta.stats = await this.#getStats( ctx.user.id );

            return res;
        }

        async API_setUndone ( ctx, notifications ) {
            const res = await this.dbh.do( sql`UPDATE user_internal_notification SET done = FALSE WHERE user_id = ${ctx.user.id} AND notification_id`.IN( notifications ) );

            res.meta.stats = await this.#getStats( ctx.user.id );

            return res;
        }

        async API_setUndoneAll ( ctx ) {
            const res = await this.dbh.do( QUERIES.setUndoneAll, [ctx.user.id] );

            res.meta.stats = await this.#getStats( ctx.user.id );

            return res;
        }

        async API_delete ( ctx, notifications ) {
            const res = await this.dbh.do( sql`DELETE FROM user_internal_notification WHERE user_id = ${ctx.user.id} AND notification_id`.IN( notifications ) );

            res.meta.stats = await this.#getStats( ctx.user.id );

            return res;
        }

        async API_deleteAll ( ctx ) {
            const res = await this.dbh.do( QUERIES.deleteAll, [ctx.user.id] );

            res.meta.stats = await this.#getStats( ctx.user.id );

            return res;
        }

        // private
        async #getStats ( userId ) {
            const res = await this.dbh.selectRow( QUERIES.getStats, [userId] );

            return res.data;
        }
    };
