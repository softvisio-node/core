import sql from "#lib/sql";

const SQL = {
    "getMethods": sql`
WITH total AS (
    SELECT
        sum( calls )::int4 AS total_calls,
        sum( duration )::int4 AS total_duration,
        sum( exceptions )::int4 AS total_exceptions
    FROM
        api_health_Calls
    WHERE
        date > CURRENT_TIMESTAMP - INTERVAL '7 days'
),
method AS (
    SELECT
        method_id,
        sum( calls )::int4 AS calls,
        sum( duration )::int4 AS duration,
        sum( exceptions )::int4 AS exceptions
    FROM
        api_health_calls
    WHERE
        date > CURRENT_TIMESTAMP - INTERVAL '7 days'
    GROUP BY
        method_id
)
SELECT
    method_id,
    calls,
    CASE WHEN calls = 0 THEN 0 ELSE ( duration::numeric / calls )::float4 END AS avg_duration,
    exceptions,
    CASE WHEN calls = 0 THEN 0 ELSE ( exceptions::numeric / calls )::float4 END AS avg_exceptions,
    CASE WHEN total_calls = 0 THEN 0 ELSE ( calls::numeric / total_calls )::float4 END AS calls_share,
    CASE WHEN total_duration = 0 THEN 0 ELSE ( duration::numeric / total_duration )::float4 END AS duration_share,
    CASE WHEN total_exceptions = 0 THEN 0 ELSE ( exceptions::numeric / total_exceptions )::float4 END AS exceptions_share
FROM
    method
    CROSS JOIN total
`.prepare(),

    "getLatestTimeSeries": sql`
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
    coalesce( calls, 0 ) AS calls,
    coalesce( ( duration::numeric / calls )::float4, 0 ) AS duration_per_call,
    coalesce( ( exceptions::numeric / calls )::float4, 0 ) AS exceptions_per_call
FROM
    series
    LEFT JOIN api_health_Calls ON ( series.date = api_health_Calls.date AND api_health_Calls.method_id = ? )
;

`.prepare(),

    // XXX
    "getHistoricTimeSeries": sql``.prepare(),
};

export default Super =>
    class extends Super {
        async API_getApiMethods ( ctx ) {
            const res = await this.dbh.select( SQL.getMethods );
            if ( !res.ok ) return res;

            const idx = {},
                data = [],
                stats = this.api.frontend.stats.totalActiveCalls;

            if ( res.data ) for ( const row of res.data ) idx[row.method_id] = row;

            for ( const method of Object.values( this.api.frontend.schema.methods ) ) {
                const row = {
                    "id": method.id,
                    "active_calls": stats[method.id] ?? 0,
                    "calls": idx[method.id]?.calls ?? 0,
                    "avg_duration": idx[method.id]?.avg_duration ?? 0,
                    "exceptions": idx[method.id]?.exceptions ?? 0,
                    "avg_exceptions": idx[method.id]?.avg_exceptions ?? 0,
                    "calls_share": idx[method.id]?.calls_share ?? 0,
                    "duration_share": idx[method.id]?.duration_share ?? 0,
                    "exceptions_share": idx[method.id]?.exceptions_share ?? 0,
                };

                data.push( row );
            }

            return result( 200, data );
        }

        async API_getLatestTimeSeries ( ctx, methodId ) {
            return this.dbh.select( SQL.getLatestTimeSeries, [methodId] );
        }

        async API_getHistoricTimeSeries ( ctx, methodId ) {
            return this.dbh.select( SQL.getHistoricTimeSeries, [methodId] );
        }

        async API_readApiMethodExceptions ( ctx, options = {} ) {
            const where = this.dbh.where();

            where.and( options.where );

            const mainQuery = sql`SELECT * FROM api_health_exception`.WHERE( where );

            return this._read( ctx, mainQuery, { options } );
        }
    };
