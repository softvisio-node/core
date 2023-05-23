import sql from "#lib/sql";
import constants from "#lib/app/constants";

export default Super =>
    class extends Super {
        async API_getUserNotificationsProfile ( ctx ) {
            const types = await this.api.notifications.getUserNotificationsProfile( ctx.user.id );

            return result( 200, types );
        }

        async API_setUserNotificationChannelEnabled ( ctx, type, channel, enabled ) {
            return this.api.notifications.setUserNotificationChannelEnabled( ctx.user.id, type, channel, enabled );
        }

        async API_read ( ctx, options ) {
            var where = this.dbh.where( sql`user_internal_notification.user_id = ${ctx.user.id} AND api_internal_notification.id = user_internal_notification.api_internal_notification_id AND ( api_internal_notification.expires IS NULL OR api_internal_notification.expires > CURRENT_TIMESTAMP )` );

            // filter search
            if ( options.where?.done != null ) {
                where.and( { "user_internal_notification.done": options.where.done } );
            }

            const summaryQuery = sql`
SELECT
    count(*)::int4 AS total
FROM
    api_internal_notification, user_internal_notification
`.WHERE( where );

            const mainQuery = sql`
SELECT
    api_internal_notification.*,
    user_internal_notification.done
FROM
    api_internal_notification,
    user_internal_notification
`.WHERE( where );

            return this._read( ctx, mainQuery, { options, summaryQuery } );
        }

        async API_update ( ctx, options ) {
            var res;

            if ( options.id ) {
                const notificationId = options.id;
                options.id;

                res = await this.dbh.do( sql`UPDATE user_internal_notification`.SET( options ).sql`WHERE user_id = ${ctx.user.id} AND id = ${notificationId}` );
            }
            else {
                res = await this.dbh.do( sql`UPDATE user_internal_notification`.SET( options ).sql`WHERE user_id = ${ctx.user.id}` );
            }

            if ( !res.ok ) {
                return res;
            }
            else if ( res.meta.rows ) {
                this.app.publish( {
                    "name": "/api/notifications/update/",
                    "targets": [ctx.user.id],
                    "arguments": [{ "inbox": true, "done": true }],
                    "publisherId": ctx.connection.id,
                } );

                return result( 200, { "inbox": true, "done": true } );
            }
            else {
                return result( 200, { "inbox": false, "done": false } );
            }
        }

        async API_delete ( ctx, options = {} ) {
            const where = sql.where( { ...options, "user_id": ctx.user.id } );

            const res = await this.dbh.selectRow( sql`
WITH deleted AS (
    DELETE FROM user_internal_notification`.WHERE( where ).sql` RETURNING done
)
SELECT
    count( nullif( done, TRUE ) )::int4::bool AS inbox,
    count( nullif( done, FALSE ) )::int4::bool AS done
FROM
    deleted
` );

            if ( res.ok ) {
                this.app.publish( {
                    "name": "/api/notifications/update/",
                    "targets": [ctx.user.id],
                    "arguments": [res.data],
                    "publisherId": ctx.connection.id,
                } );
            }

            return res;
        }

        async API_getLinkTelegramAccountUrl ( ctx ) {
            if ( !this.api.notifications.telegramSupported ) {
                return result( [500, `Telegram is not supported`] );
            }

            const res = await this.app.api.userActionTokens.createUserActionToken( -1, constants.tokenTypeLinkTelegramAccount, { "data": { "userId": ctx.user.id } } );

            if ( !res.ok ) return res;

            const url = new URL( "tg://resolve" );
            url.searchParams.set( "domain" );
            url.searchParams.set( "start", "link-user:" + res.data.token );

            return result( 200, url.hrf() );
        }
    };
