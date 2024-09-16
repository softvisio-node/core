import sql from "#lib/sql";

const STATS_PERIODS = {
    "1 hour": "minute",
    "7 days": "hour",
    "30 days": "hour",
};

const SQL = {
    "getInstances": sql`SELECT * FROM monitoring_instance WHERE last_updated > CURRENT_TIMESTAMP - INTERVAL '1 hour'`.prepare(),

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
stats AS (
    SELECT
        date_trunc( ( SELECT step FROM params ), date ) AS date1,
        avg( cpu_used )::number2::float8 AS cpu_used,
        ( avg( ram_used ) / 1048576)::int53 AS ram_used,
        avg( ram_used_percent )::number2::float8 AS ram_used_percent,
        ( avg( rss_used ) / 1048576)::int53 AS rss_used,
        avg( rss_used_percent )::number2::float8 AS rss_used_percent,
        ( avg( hdd_used ) / 1048576)::int53 AS hdd_used,
        avg( hdd_used_percent )::number2::float8 AS hdd_used_percent
    FROM
        monitoring_instance_stats
    WHERE
        monitoring_instance_id = ?
        AND date >= ( SELECT start FROM params )
    GROUP BY
        date1
)
SELECT
    series.date,
    coalesce( cpu_used, 0 ) AS cpu_used,
    ram_used,
    ram_used_percent,
    rss_used,
    rss_used_percent,
    hdd_used,
    hdd_used_percent
FROM
    series
    LEFT JOIN stats ON ( series.date = stats.date1 )
`.prepare(),
};

export default Super =>
    class extends Super {
        async API_getInstances ( ctx ) {
            return this.dbh.select( SQL.getInstances );
        }

        async API_getInstanceStats ( ctx, instanceId, period ) {
            return this.dbh.select( SQL.getStats, [ period, STATS_PERIODS[ period ], instanceId ] );
        }
    };
