import sql from "#lib/sql";

const STATS_PERIODS = {
    "1 hour": "minute",
    "7 days": "hour",
    "30 days": "hour",
};

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
        CASE WHEN calls = 0 THEN 0 ELSE ( duration::numeric / calls ) END AS duration_per_call,
        exceptions,
        CASE WHEN calls = 0 THEN 0 ELSE ( exceptions::numeric / calls ) END AS exceptions_per_call,
        CASE WHEN total_calls = 0 THEN 0 ELSE ( calls::numeric / total_calls ) END AS calls_share,
        CASE WHEN total_duration = 0 THEN 0 ELSE ( duration::numeric / total_duration ) END AS duration_share,
        CASE WHEN total_exceptions = 0 THEN 0 ELSE ( exceptions::numeric / total_exceptions ) END AS exceptions_share
    FROM
        method
        CROSS JOIN total
)
SELECT
    monitoring_method.id AS id,
    monitoring_method.package AS package,
    monitoring_method.component AS component,
    monitoring_method.method AS method,
    stats.calls,
    stats.duration_per_call,
    stats.exceptions,
    stats.exceptions_per_call,
    stats.calls_share,
    stats.duration_share,
    stats.exceptions_share
FROM
    monitoring_method
    LEFT JOIN stats ON ( monitoring_method.id = stats.id )
`.prepare(),

    "getStats": sql`
WITH params AS (
    WITH args AS ( SELECT ?::interval AS interval, ?::text AS step ),
    step_interval AS ( SELECT ( '1 ' || ( SELECT step FROM args ) )::interval AS interval )
    SELECT
        ( SELECT step FROM args ) AS step,
        ( SELECT interval FROM step_interval ) AS step_interval,
        ( date_trunc( ( SELECT step FROM args ), CURRENT_TIMESTAMP ) - ( SELECT interval FROM args ) + ( SELECT interval FROM step_interval ) ) AS start,
        date_trunc( ( SELECT step FROM args ), CURRENT_TIMESTAMP ) AS end
),
series AS (
    SELECT date FROM generate_series(
        ( SELECT start FROM params ),
        ( SELECT "end" FROM params ),
        ( SELECT step_interval FROM params )
    ) AS date
),
calls AS (
    SELECT
        date_trunc( ( SELECT step FROM params ), date ) AS date1,
        sum( calls ) AS calls,
        sum( duration ) AS duration,
        sum( exceptions ) AS exceptions
    FROM
        monitoring_method_stats
    WHERE
        monitoring_method_id = ?
        AND date >= ( SELECT start FROM params )
    GROUP BY
        date1
)
SELECT
    series.date,
    coalesce( calls::int4, 0 ) AS calls,
    coalesce( ( duration::numeric / calls )::float8, 0 ) AS duration_per_call,
    coalesce( ( exceptions::numeric / calls  )::float8, 0 ) AS exceptions_percent
FROM
    series
    LEFT JOIN Calls ON ( series.date = Calls.date1 )
`.prepare(),

    "clearApiMethodExceptions": sql`DELETE FROM monitoring_method_exception WHERE monitoring_method_id = ?`.prepare(),
};

export default Super =>
    class extends Super {
        async API_getMethods ( ctx, { period } ) {
            return this.dbh.select( SQL.getMethods, [ period, period ] );
        }

        async API_getMonitoringMethodStats ( ctx, monitoringMethodId, period ) {
            return this.dbh.select( SQL.getStats, [ period, STATS_PERIODS[ period ], monitoringMethodId ] );
        }

        async API_getMethodExceptionsList ( ctx, options = {} ) {
            const where = sql.where();

            where.and( options.where );

            const mainQuery = sql`SELECT * FROM monitoring_method_exception`.WHERE( where );

            return this._read( ctx, mainQuery, { options } );
        }

        async API_clearMethodExceptions ( ctx, monitoringMethodId ) {
            return this.dbh.do( SQL.clearApiMethodExceptions, [ monitoringMethodId ] );
        }
    };
