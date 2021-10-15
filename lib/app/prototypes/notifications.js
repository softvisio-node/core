import mixins from "#lib/mixins";
import Base from "./base.js";
import Read from "./mixins/read.js";
import sql from "#lib/sql";

const QUERIES = {
    "setReadAll": sql`UPDATE user_notification SET read = TRUE WHERE user_id = ?`.prepare(),
    "setUnreadAll": sql`UPDATE user_notification SET read = FALSE WHERE user_id = ?`.prepare(),
    "setDoneAll": sql`UPDATE user_notification SET done = TRUE WHERE user_id = ?`.prepare(),
    "setUndoneAll": sql`UPDATE user_notification SET done = FALSE WHERE user_id = ?`.prepare(),
    "deleteAll": sql`DELETE FROM user_notification WHERE user_id = ?`.prepare(),
};

export default class extends mixins( Read, Base ) {
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

    async API_setRead ( ctx, notifications ) {
        return this.dbh.do( sql`UPDATE user_notification SET read = TRUE WHERE user_id = ${ctx.userId} AND notification_id`.IN( notifications ) );
    }

    async API_setReadAll ( ctx ) {
        return this.dbh.do( QUERIES.setReadAll, [ctx.userId] );
    }

    async API_setUnread ( ctx, notifications ) {
        return this.dbh.do( sql`UPDATE user_notification SET read = FALSE WHERE user_id = ${ctx.userId} AND notification_id`.IN( notifications ) );
    }

    async API_setUnreadAll ( ctx ) {
        return this.dbh.do( QUERIES.setUnreadAll, [ctx.userId] );
    }

    async API_setDone ( ctx, notifications ) {
        return this.dbh.do( sql`UPDATE user_notification SET done = TRUE WHERE user_id = ${ctx.userId} AND notification_id`.IN( notifications ) );
    }

    async API_setDoneAll ( ctx ) {
        return this.dbh.do( QUERIES.setDoneAll, [ctx.userId] );
    }

    async API_setUndone ( ctx, notifications ) {
        return this.dbh.do( sql`UPDATE user_notification SET done = FALSE WHERE user_id = ${ctx.userId} AND notification_id`.IN( notifications ) );
    }

    async API_setUndoneAll ( ctx ) {
        return this.dbh.do( QUERIES.setUndoneAll, [ctx.userId] );
    }

    async API_delete ( ctx, notifications ) {
        return this.dbh.do( sql`DELETE FROM user_notification WHERE user_id = ${ctx.userId} AND notification_id`.IN( notifications ) );
    }

    async API_deleteAll ( ctx ) {
        return this.dbh.do( QUERIES.deleteAll, [ctx.userId] );
    }
}
