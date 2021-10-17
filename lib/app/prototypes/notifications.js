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
    "getStats": sql`
SELECT
    count( nullif( done, TRUE ) )::int4 AS total_undone,
    count( coalesce( nullif( done, FALSE ), nullif( read, TRUE ) ) )::int4 AS total_undone_unread
FROM
    user_notification
wHERE user_id = ?`.prepare(),
};

export default class extends mixins( Read, Base ) {
    async API_read ( ctx, options = {} ) {
        var where = this.dbh.where( sql`user_notification.user_id = ${ctx.userId} AND notification.id = user_notification.notification_id AND ( notification.expires IS NULL OR notification.expires > CURRENT_TIMESTAMP )` );

        // filter search
        if ( options.where?.done != null ) {
            where.and( { "user_notification.done": options.where.done } );
        }

        const totalQuery = sql`SELECT count(*)::int4 AS total, count( nullif( user_notification.read, TRUE ) )::int4 AS total_undone_unread FROM notification, user_notification`.WHERE( where );

        const mainQuery = sql`SELECT notification.*, user_notification.done, user_notification.read FROM notification, user_notification`.WHERE( where );

        return this._read( ctx, totalQuery, mainQuery, options );
    }

    async API_setRead ( ctx, notifications ) {
        const res = await this.dbh.do( sql`UPDATE user_notification SET read = TRUE WHERE user_id = ${ctx.userId} AND notification_id`.IN( notifications ) );

        res.meta.stats = await this.#getStats( ctx.userId );

        return res;
    }

    async API_setReadAll ( ctx ) {
        const res = await this.dbh.do( QUERIES.setReadAll, [ctx.userId] );

        res.meta.stats = await this.#getStats( ctx.userId );

        return res;
    }

    async API_setUnread ( ctx, notifications ) {
        const res = await this.dbh.do( sql`UPDATE user_notification SET read = FALSE WHERE user_id = ${ctx.userId} AND notification_id`.IN( notifications ) );

        res.meta.stats = await this.#getStats( ctx.userId );

        return res;
    }

    async API_setUnreadAll ( ctx ) {
        const res = await this.dbh.do( QUERIES.setUnreadAll, [ctx.userId] );

        res.meta.stats = await this.#getStats( ctx.userId );

        return res;
    }

    async API_setDone ( ctx, notifications ) {
        const res = await this.dbh.do( sql`UPDATE user_notification SET done = TRUE WHERE user_id = ${ctx.userId} AND notification_id`.IN( notifications ) );

        res.meta.stats = await this.#getStats( ctx.userId );

        return res;
    }

    async API_setDoneAll ( ctx ) {
        const res = await this.dbh.do( QUERIES.setDoneAll, [ctx.userId] );

        res.meta.stats = await this.#getStats( ctx.userId );

        return res;
    }

    async API_setUndone ( ctx, notifications ) {
        const res = await this.dbh.do( sql`UPDATE user_notification SET done = FALSE WHERE user_id = ${ctx.userId} AND notification_id`.IN( notifications ) );

        res.meta.stats = await this.#getStats( ctx.userId );

        return res;
    }

    async API_setUndoneAll ( ctx ) {
        const res = await this.dbh.do( QUERIES.setUndoneAll, [ctx.userId] );

        res.meta.stats = await this.#getStats( ctx.userId );

        return res;
    }

    async API_delete ( ctx, notifications ) {
        const res = await this.dbh.do( sql`DELETE FROM user_notification WHERE user_id = ${ctx.userId} AND notification_id`.IN( notifications ) );

        res.meta.stats = await this.#getStats( ctx.userId );

        return res;
    }

    async API_deleteAll ( ctx ) {
        const res = await this.dbh.do( QUERIES.deleteAll, [ctx.userId] );

        res.meta.stats = await this.#getStats( ctx.userId );

        return res;
    }

    // private
    async #getStats ( userId ) {
        const res = await this.dbh.selectRow( QUERIES.getStats, [userId] );

        return res.data;
    }
}
