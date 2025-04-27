import sql from "#lib/sql";

export default Super =>
    class extends Super {

        // public
        async [ "API_getUserNotificationsProfile" ] ( ctx, { "acl_id": aclId } = {} ) {
            var userNotifications;

            if ( aclId ) {
                userNotifications = await this.app.acl.getAclUserNotificationsProfile( aclId, ctx.user.id );
            }
            else {
                userNotifications = await this.app.notifications.getUserNotificationsProfile( ctx.user.id );
            }

            if ( !userNotifications.ok ) return userNotifications;

            const notifications = this.app.notifications;

            const profile = {
                "telegramSupported": notifications.channels.telegram.supported,
            };

            if ( profile.telegramSupported ) {
                profile.telegramBotUrl = "https://t.me/" + notifications.telegramBotUsername;

                profile.linkedTelegramUser = await notifications.getTelegramBotUserByApiUserId( ctx.user.id );
            }

            profile.notifications = userNotifications.data;

            return result( 200, profile );
        }

        async [ "API_setUserNotificationSubscribed" ] ( ctx, { "acl_id": aclId, notification, channel, subscribed } = {} ) {
            if ( aclId ) {
                return this.app.acl.setAclUserNotificationSubscribed( {
                    aclId,
                    "userId": ctx.user.id,
                    notification,
                    channel,
                    subscribed,
                } );
            }
            else {
                return this.app.notifications.setUserNotificationSubscribed( {
                    "userId": ctx.user.id,
                    notification,
                    channel,
                    subscribed,
                } );
            }
        }

        async [ "API_getNotificationsList" ] ( ctx, options ) {
            var where = sql.where( sql`notification_internal_user.user_id = ${ ctx.user.id } AND notification_internal.id = notification_internal_user.notification_internal_id AND ( notification_internal.expires IS NULL OR notification_internal.expires > CURRENT_TIMESTAMP )` );

            // filter search
            if ( options.where?.done != null ) {
                where.and( { "notification_internal_user.done": options.where.done } );
            }

            const summaryQuery = sql`
SELECT
    count(*)::int4 AS total
FROM
    notification_internal, notification_internal_user
`.WHERE( where );

            const mainQuery = sql`
SELECT
    notification_internal.*,
    notification_internal_user.done
FROM
    notification_internal,
    notification_internal_user
`.WHERE( where );

            return this._read( ctx, mainQuery, { options, summaryQuery } );
        }

        async [ "API_update" ] ( ctx, options ) {
            var res;

            if ( options.id ) {
                const notificationId = options.id;
                options.id;

                res = await this.dbh.do( sql`UPDATE notification_internal_user`.SET( options ).sql`WHERE user_id = ${ ctx.user.id } AND id = ${ notificationId }` );
            }
            else {
                res = await this.dbh.do( sql`UPDATE notification_internal_user`.SET( options ).sql`WHERE user_id = ${ ctx.user.id }` );
            }

            if ( !res.ok ) {
                return res;
            }
            else if ( res.meta.rows ) {
                this.app.publishToApi( {
                    "name": "/notifications/update/",
                    "users": [ ctx.user.id ],
                    "data": [ { "inbox": true, "done": true } ],
                    "publisherId": ctx.connection.id,
                } );

                return result( 200, { "inbox": true, "done": true } );
            }
            else {
                return result( 200, { "inbox": false, "done": false } );
            }
        }

        async [ "API_delete" ] ( ctx, options = {} ) {
            const where = sql.where( { ...options, "user_id": ctx.user.id } );

            const res = await this.dbh.selectRow( sql`
WITH deleted AS (
    DELETE FROM notification_internal_user`.WHERE( where ).sql` RETURNING done
)
SELECT
    count( nullif( done, TRUE ) )::int4::bool AS inbox,
    count( nullif( done, FALSE ) )::int4::bool AS done
FROM
    deleted
` );

            if ( res.ok ) {
                this.app.publishToApi( {
                    "name": "/notifications/update/",
                    "users": [ ctx.user.id ],
                    "data": [ res.data ],
                    "publisherId": ctx.connection.id,
                } );
            }

            return res;
        }
    };
