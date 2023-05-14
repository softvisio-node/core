import sql from "#lib/sql";

const SQL = {
    "getStats": sql`
SELECT
    count( nullif( done, TRUE ) )::int4 AS total_undone,
    count( CASE WHEN ( done = FALSE AND read = FALSE ) THEN TRUE ELSE NULL END )::int4 AS total_undone_unread
FROM
    user_internal_notification
wHERE user_id = ?`.prepare(),
};

export default Super =>
    class extends Super {
        async API_getUserNotificationsProfile ( ctx ) {
            const types = await this.api.notifications.getUserNotificationsProfile( ctx.user.id );

            return result( 200, types );
        }

        async API_setUserNotificationChannelEnabled ( ctx, type, channel, enabled ) {
            return this.api.notifications.setUserNotificationChannelEnabled( ctx.user.id, type, channel, enabled );
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

        async API_update ( ctx, notificationId, options ) {
            const res = await this.dbh.do( sql`UPDATE user_internal_notification`.SET( options ).sql`WHERE user_id = ${ctx.user.id} AND id = ${notificationId}` );

            res.meta.stats = await this.#getStats( ctx.user.id );

            return res;
        }

        async API_updateAll ( ctx, options ) {
            const res = await this.dbh.do( sql`UPDATE user_internal_notification`.SET( options ).sql`WHERE user_id = ${ctx.user.id}` );

            res.meta.stats = await this.#getStats( ctx.user.id );

            return res;
        }

        async API_delete ( ctx, options ) {
            const where = sql.where( "user_id =", ctx.user.id, "AND", options );

            const res = await this.dbh.do( sql`DELETE FROM user_internal_notification`.WHERE( where ) );

            res.meta.stats = await this.#getStats( ctx.user.id );

            return res;
        }

        // private
        async #getStats ( userId ) {
            const res = await this.dbh.selectRow( SQL.getStats, [userId] );

            return res.data;
        }
    };
