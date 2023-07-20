import sql from "#lib/sql";
import constants from "#lib/app/constants";

export default Super =>
    class extends Super {
        async API_getUserNotificationsProfile ( ctx ) {
            const types = await this.app.notifications.getUserNotificationsProfile( ctx.user.id );

            return result( 200, types );
        }

        async API_setUserNotificationChannelActive ( ctx, notification, channel, active ) {
            return this.app.notifications.setUserNotificationChannelActive( ctx.user.id, notification, channel, active );
        }

        async API_setUserNotificationActive ( ctx, notification, active ) {
            return this.app.notifications.setUserNotificationActive( ctx.user.id, notification, active );
        }

        async API_read ( ctx, options ) {
            var where = sql.where( sql`notification_internal_user.user_id = ${ctx.user.id} AND notification_internal.id = notification_internal_user.notification_internal_id AND ( notification_internal.expires IS NULL OR notification_internal.expires > CURRENT_TIMESTAMP )` );

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

        async API_update ( ctx, options ) {
            var res;

            if ( options.id ) {
                const notificationId = options.id;
                options.id;

                res = await this.dbh.do( sql`UPDATE notification_internal_user`.SET( options ).sql`WHERE user_id = ${ctx.user.id} AND id = ${notificationId}` );
            }
            else {
                res = await this.dbh.do( sql`UPDATE notification_internal_user`.SET( options ).sql`WHERE user_id = ${ctx.user.id}` );
            }

            if ( !res.ok ) {
                return res;
            }
            else if ( res.meta.rows ) {
                this.app.publishToApi( {
                    "name": "/notifications/update/",
                    "users": [ctx.user.id],
                    "data": [{ "inbox": true, "done": true }],
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
                    "users": [ctx.user.id],
                    "data": [res.data],
                    "publisherId": ctx.connection.id,
                } );
            }

            return res;
        }

        async API_getTelegramLinkUrl ( ctx ) {
            if ( !this.app.notifications.telegramSupported ) {
                return result( [500, `Telegram is not supported`] );
            }

            const linkedTelegramUsername = await this.app.notifications.getLinkedTelegramUsername( ctx.user.id );

            if ( linkedTelegramUsername ) {
                return result( 200, {
                    linkedTelegramUsername,
                } );
            }
            else {
                const res = await this.app.actionTokens.createActionToken( ctx.user.id, constants.tokenTypeLinkTelegramAccount, { "length": 6, "data": { "userId": ctx.user.id } } );

                if ( !res.ok ) return res;

                const start = this.app.telegram.encodeArgument( { "apiUserToken": res.data.token } );

                const linkTelegramBotUrl = new URL( "https://t.me/" + this.app.notifications.telegramBotUsername );
                linkTelegramBotUrl.searchParams.set( "start", start );

                return result( 200, { linkTelegramBotUrl } );
            }
        }

        async API_unlinkTelegram ( ctx ) {
            return this.app.notifications.unlinkTelegram( ctx.user.id );
        }
    };
