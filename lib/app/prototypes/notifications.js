import mixins from "#lib/mixins";
import Base from "./base.js";
import Read from "./mixins/read.js";
import sql from "#lib/sql";

export default class extends mixins( Read, Base ) {

    // XXX try witout total
    async API_read ( ctx, args = {} ) {
        var where = this.dbh.where( sql`user_notification.user_id = ${ctx.userId} AND notification.id = user_notification.notification_id AND notification.expires > CURRENT_TIMESTAMP` );

        // filter search
        if ( args.where && args.where.done != null ) {
            where.and( { "user_notification.done": args.where.done } );
        }

        const totalQuery = sql`SELECT COUNT(*) AS total FROM notification, user_notification`.WHERE( where );

        const mainQuery = sql`SELECT notification.*, user_notification.done, user_notification.read FROM notification, user_notification`.WHERE( where );

        return this._read( ctx, totalQuery, mainQuery, args );
    }

    async API_setDone ( ctx, notifications ) {
        return this.dbh.do( sql`UPDATE user_notification SET done = TRUE WHERE user_id = ${ctx.userId} AND notification_id`.IN( notifications ) );
    }

    async API_setUndone ( ctx, notifications ) {
        return this.dbh.do( sql`UPDATE user_notification SET done = FALSE WHERE user_id = ${ctx.userId} AND notification_id`.IN( notifications ) );
    }

    async API_setRead ( ctx, notifications ) {
        return this.dbh.do( sql`UPDATE user_notification SET read = TRUE WHERE user_id = ${ctx.userId} AND notification_id`.IN( notifications ) );
    }

    async API_setUnread ( ctx, notifications ) {
        return this.dbh.do( sql`UPDATE user_notification SET read = FALSE WHERE user_id = ${ctx.userId} AND notification_id`.IN( notifications ) );
    }

    async API_delete ( ctx, notifications ) {
        return this.dbh.do( sql`DELETE FROM user_notification WHERE user_id = ${ctx.userId} AND notification_id`.IN( notifications ) );
    }
}
