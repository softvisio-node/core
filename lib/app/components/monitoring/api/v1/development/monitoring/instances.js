import sql from "#lib/sql";

const SQL = {
    "getInstances": sql`SELECT * FROM monitoring_instance WHERE last_updated > CURRENT_TIMESTAMP - INTERVAL '1 hour'`.prepare(),

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
    coalesce( cpu_user_delta, 0 ) AS cpu_user_delta,
    coalesce( cpu_system_delta, 0 ) AS cpu_system_delta,
    coalesce( memory_free, 0 ) AS memory_free,
    coalesce( memory_rss, 0 ) AS memory_rss,
    coalesce( fs_free, 0 ) AS fs_free
FROM
    series
    LEFT JOIN monitoring_instance_stats ON ( series.date = monitoring_instance_stats.date AND monitoring_instance_stats.monitoring_instance_id = ? )
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
    coalesce( ( exceptions::float8 / calls * 100 )::float8, 0 ) AS exceptions_percent
FROM
    series
    LEFT JOIN Calls ON ( series.date = Calls.date1 )
`.prepare(),
};

export default Super =>
    class extends Super {
        async API_getInstances ( ctx ) {
            return this.dbh.select( SQL.getInstances );
        }

        async API_getLatestTimeSeries ( ctx, monitoringInstanceId ) {
            return this.dbh.select( SQL.getLatestTimeSeries, [monitoringInstanceId] );
        }

        async API_getHistoricalTimeSeries ( ctx, monitoringInstanceId ) {
            return this.dbh.select( SQL.getHistoricalTimeSeries, [monitoringInstanceId] );
        }
    };
