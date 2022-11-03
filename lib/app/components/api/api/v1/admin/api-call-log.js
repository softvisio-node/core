import mixins from "#lib/mixins";
import sql from "#lib/sql";
import Read from "#lib/app/mixins/read";
import { objectIsEmpty } from "#lib/utils";

export default Super =>
    class extends mixins( Read, Super ) {
        async API_readApiMethodAccessLog ( ctx, options = {} ) {
            var where = this.dbh.where();

            where.and( options.where );

            const mainQuery = sql`SELECT * FROM api_call_log`.WHERE( where );

            return this._read( ctx, mainQuery, { options } );
        }

        async API_getLatestStats ( ctx, method ) {
            const methods = this.api.frontend.schema.getLogMethods();

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
                stats = this.api.frontend.requestsStats;

            for ( const methodId in methods ) {
                const row = {
                    "id": methodId,
                    "active_requests_limit": methods[methodId].activeRequestsLimit,
                    "active_requests_user_limit": methods[methodId].activeRequestsUserLimit,
                    "total_active_requests": stats[methodId]?.total ?? 0,
                    "series": idx[methodId],
                };

                data.push( row );
            }

            return result( 200, data );
        }

        async API_getHistoryStats ( ctx, method ) {
            return this.dbh.select( sql`SELECT date, total_accepted, total_declined, avg_runtime, errors_percent FROM get_api_call_log_historic(?)`, [method] );
        }
    };
