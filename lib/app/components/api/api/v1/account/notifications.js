import sql from "#lib/sql";

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
    count(*)::int4 AS total
FROM
    internal_notification, user_internal_notification
`.WHERE( where );

            const mainQuery = sql`SELECT internal_notification.*, user_internal_notification.done, user_internal_notification.read FROM internal_notification, user_internal_notification`.WHERE( where );

            return this._read( ctx, mainQuery, { options, summaryQuery } );
        }

        async API_update ( ctx, notificationId, options ) {
            const res = await this.dbh.do( sql`UPDATE user_internal_notification`.SET( options ).sql`WHERE user_id = ${ctx.user.id} AND id = ${notificationId}` );

            return res;
        }

        async API_updateAll ( ctx, options ) {
            const res = await this.dbh.do( sql`UPDATE user_internal_notification`.SET( options ).sql`WHERE user_id = ${ctx.user.id}` );

            return res;
        }

        async API_delete ( ctx, options = {} ) {
            const where = sql.where( { ...options, "user_id": ctx.user.id } );

            const res = await this.dbh.do( sql`DELETE FROM user_internal_notification`.WHERE( where ) );

            return res;
        }
    };
