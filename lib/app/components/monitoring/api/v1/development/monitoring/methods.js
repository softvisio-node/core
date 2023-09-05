import sql from "#lib/sql";

const SQL = {
    "getMethods": sql`
WITH total AS (
    SELECT
        sum( calls )::int4 AS total_calls,
        sum( duration )::int4 AS total_duration,
        sum( exceptions )::int4 AS total_exceptions
    FROM
        monitoring_method_stats
    WHERE
        date >= CURRENT_TIMESTAMP - ? * INTERVAL '1 day'
),
method AS (
    SELECT
        monitoring_method_id AS id,
        sum( calls )::int4 AS calls,
        sum( duration )::int4 AS duration,
        sum( exceptions )::int4 AS exceptions
    FROM
        monitoring_method_stats
    WHERE
        date >= CURRENT_TIMESTAMP - ? * INTERVAL '1 day'
    GROUP BY
        monitoring_method_id
),
stats AS (
    SELECT
        id,
        calls,
        CASE WHEN calls = 0 THEN 0 ELSE ( duration::float8 / calls )::float8 END AS duration_per_call,
        exceptions,
        CASE WHEN calls = 0 THEN 0 ELSE ( exceptions::float8 / calls )::float8 END AS exceptions_per_call,
        CASE WHEN total_calls = 0 THEN 0 ELSE ( calls::float8 / total_calls )::float8 END AS calls_share,
        CASE WHEN total_duration = 0 THEN 0 ELSE ( duration::float8 / total_duration )::float8 END AS duration_share,
        CASE WHEN total_exceptions = 0 THEN 0 ELSE ( exceptions::float8 / total_exceptions )::float8 END AS exceptions_share
    FROM
        method
        CROSS JOIN total
)
SELECT
    monitoring_method.package AS package,
    monitoring_method.component AS component,
    monitoring_method.method AS method,
    stats.*
FROM
    monitoring_method
    LEFT JOIN stats ON ( monitoring_method.id = stats.id )
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
    coalesce( ( duration::float8 / calls )::float8, 0 ) AS duration_per_call,
    coalesce( ( exceptions::float8 / calls  )::float8, 0 ) AS exceptions_percent
FROM
    series
    LEFT JOIN monitoring_method_stats ON ( series.date = monitoring_method_stats.date AND monitoring_method_stats.monitoring_method_id = ? )
;

`.prepare(),

    "getHistoricalTimeSeries": sql`
WITH series AS (
    SELECT
        *
    FROM
        generate_series(
            date_trunc( 'hour', CURRENT_TIMESTAMP - INTERVAL '30 days' ) + INTERVAL '1 hour',
            date_trunc( 'hour', CURRENT_TIMESTAMP ),
            INTERVAL '1 hour'
        ) AS date
),
calls AS (
    SELECT
        date_trunc( 'hour', date ) AS date1,
        sum( calls ) AS calls,
        sum( duration ) AS duration,
        sum( exceptions ) AS exceptions
    FROM
        monitoring_method_stats
    WHERE
        monitoring_method_id = ?
        AND date >= date_trunc( 'hour', CURRENT_TIMESTAMP - INTERVAL '30 days' ) + INTERVAL '1 hour'
    GROUP BY
        date1
)
SELECT
    series.date,
    coalesce( calls::int4, 0 ) AS calls,
    coalesce( ( duration::float8 / calls )::float8, 0 ) AS duration_per_call,
    coalesce( ( exceptions::float8 / calls  )::float8, 0 ) AS exceptions_percent
FROM
    series
    LEFT JOIN Calls ON ( series.date = Calls.date1 )
`.prepare(),

    "clearApiMethodExceptions": sql`DELETE FROM monitoring_method_exception WHERE monitoring_method_id = ?`.prepare(),
};

export default Super =>
    class extends Super {
        async API_getMethods ( ctx, { period } ) {
            return this.dbh.select( SQL.getMethods, [period, period] );
        }

        async API_getLatestTimeSeries ( ctx, monitoringMethodId ) {
            return this.dbh.select( SQL.getLatestTimeSeries, [monitoringMethodId] );
        }

        async API_getHistoricalTimeSeries ( ctx, monitoringMethodId ) {
            return this.dbh.select( SQL.getHistoricalTimeSeries, [monitoringMethodId] );
        }

        async API_readMethodExceptions ( ctx, options = {} ) {
            const where = sql.where();

            where.and( options.where );

            const mainQuery = sql`SELECT * FROM monitoring_method_exception`.WHERE( where );

            return this._read( ctx, mainQuery, { options } );
        }

        async API_clearMethodExceptions ( ctx, monitoringMethodId ) {
            return this.dbh.do( SQL.clearApiMethodExceptions, [monitoringMethodId] );
        }
    };
