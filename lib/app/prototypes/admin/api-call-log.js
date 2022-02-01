import mixins from "#lib/mixins";
import sql from "#lib/sql";
import Base from "../base.js";
import Read from "../mixins/read.js";
import { objectIsEmpty } from "#lib/utils";

export default class extends mixins( Read, Base ) {
    async API_readApiMethodAccessLog ( ctx, options = {} ) {
        var where = this.dbh.where();

        where.and( options.where );

        const mainQuery = sql`SELECT * FROM api_call_log`.WHERE( where );

        return this._read( ctx, mainQuery, { options } );
    }

    async API_getLatestStats ( ctx, method ) {
        const methods = this.api.schema.getLogMethods();

        // no methods to return
        if ( objectIsEmpty( methods ) ) return result( 200 );

        const res = await this.dbh.select( sql`SELECT * FROM get_api_call_log_latest()` );
        if ( !res.ok ) return res;

        const idx = {};

        for ( const row of res.data ) {
            ( idx[row.method_id] ||= [] ).push( row );
            delete row.method_id;
        }

        const data = [],
            stat = this.api.stat;

        for ( const method in methods ) {
            const row = {
                "id": method,
                "active_requests_limit": methods[method].activeRequestsLimit || null,
                "active_requests_user_limit": methods[method].activeRequestsUserLimit || null,
                "total_active_requests": ( stat[method] || {} ).total || 0,
                "series": idx[method],
            };

            data.push( row );
        }

        return result( 200, data );
    }

    async API_getHistoryStats ( ctx, method ) {
        return this.dbh.select( sql`SELECT * FROM get_api_call_log_historic(?)`, [method] );
    }
}
