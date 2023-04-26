import sql from "#lib/sql";

const SQL = {
    "latest": sql`
WITH series AS (
    SELECT
        *
    FROM
        generate_series(
            date_trunc( 'minute', CURRENT_TIMESTAMP - INTERVAL '59 minutes' ),
            date_trunc( 'minute', CURRENT_TIMESTAMP ),
            INTERVAL '1 minute'
        ) AS date
)
SELECT
    series.date,
    api_health_Call.calls,
    ( duration::float4 / calls )::float4 AS avg_duration,
    exceptions * 100 / calls AS exceptions_percent
FROM
    series
    LEFT JOIN api_health_Call ON ( series.date = api_health_Call.date AND api_health_Call.method_id = ? )
;

`.prepare(),
};

export default Super =>
    class extends Super {
        async API_getApiMethods ( ctx ) {
            const data = [],
                stats = this.api.frontend.requestsStats;

            for ( const method of Object.values( this.api.frontend.schema.methods ) ) {
                const row = {
                    "id": method.id,
                    "active_requests_limit": method.activeRequestsLimit,
                    "active_requests_user_limit": method.activeRequestsUserLimit,
                    "total_active_requests": stats[method.id]?.total ?? 0,
                };

                data.push( row );
            }

            return result( 200, data );
        }

        async API_getLatestStats ( ctx, methodId ) {
            return this.dbh.select( SQL.latest, [methodId] );
        }

        async API_getHistoricStats ( ctx, methodId ) {
            return this.dbh.select( sql`SELECT date, total_accepted, total_declined, avg_runtime, errors_percent FROM get_api_call_log_historic(?)`, [methodId] );
        }

        async API_readApiMethodAccessLog ( ctx, options = {} ) {
            var where = this.dbh.where();

            where.and( options.where );

            const mainQuery = sql`SELECT * FROM api_call_log`.WHERE( where );

            return this._read( ctx, mainQuery, { options } );
        }
    };
