import sql from "#lib/sql";
import constants from "#lib/app/constants";

export default Super =>
    class extends Super {
        async API_getUserNotificationsProfile ( ctx ) {
            const types = await this.app.notifications.getUserNotificationsProfile( ctx.user.id );

            return result( 200, types );
        }

        async API_setUserNotificationChannelEnabled ( ctx, type, channel, enabled ) {
            return this.app.notifications.setUserNotificationChannelEnabled( ctx.user.id, type, channel, enabled );
        }

        async API_read ( ctx, options ) {
            var where = this.dbh.where( sql`notification_internal_user.user_id = ${ctx.user.id} AND notification_internal.id = notification_internal_user.notification_internal_id AND ( notification_internal.expires IS NULL OR notification_internal.expires > CURRENT_TIMESTAMP )` );

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
                this.app.publishApi( {
                    "name": "/notifications/update/",
                    "users": [ctx.user.id],
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
    DELETE FROM notification_internal_user`.WHERE( where ).sql` RETURNING done
)
SELECT
    count( nullif( done, TRUE ) )::int4::bool AS inbox,
    count( nullif( done, FALSE ) )::int4::bool AS done
FROM
    deleted
` );

            if ( res.ok ) {
                this.app.publishApi( {
                    "name": "/notifications/update/",
                    "users": [ctx.user.id],
                    "arguments": [res.data],
                    "publisherId": ctx.connection.id,
                } );
            }

            return res;
        }

        async API_getTelegramLinkUrl ( ctx ) {
            if ( !this.app.notifications.telegramSupported ) {
                return result( [500, `Telegram is not supported`] );
            }

            const linked = await this.app.notifications.isTelegramLinked( ctx.user.id );

            if ( linked ) {
                return result( 200, {
                    "telegramLinked": true,
                } );
            }
            else {
                const res = await this.app.actionTokens.createActionToken( -1, constants.tokenTypeLinkTelegramAccount, { "data": { "userId": ctx.user.id } } );

                if ( !res.ok ) return res;

                const localUrl = new URL( "tg://resolve" );
                localUrl.searchParams.set( "domain", this.app.notifications.telegramBotUsername );
                localUrl.searchParams.set( "start", "link-user-" + res.data.token );

                const remoteUrl = new URL( "https://t.me/" + this.app.notifications.telegramBotUsername );
                remoteUrl.searchParams.set( "start", "link-user-" + res.data.token );

                return result( 200, { localUrl, remoteUrl } );
            }
        }

        async API_unlinkTelegram ( ctx ) {
            return this.app.notifications.unlinkTelegram( ctx.user.id );
        }
    };
