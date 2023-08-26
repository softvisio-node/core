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
    coalesce( cpu_user_delta, 0 ) AS cpu_user,
    coalesce( cpu_system_delta, 0 ) AS cpu_system,
    ( memory_free / 1048576 )::int53 AS memory_free,
    ( memory_rss / 1048576 )::int53 AS memory_rss,
    ( fs_free / 1048576 )::int53 AS fs_free
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
stats AS (
    SELECT
        date_trunc( 'hour', date ) AS date1,
        avg( cpu_user_delta )::int53 AS cpu_user_delta,
        avg( cpu_system_delta )::int53 AS cpu_system_delta,
        ( avg( memory_free ) / 1048576)::int53 AS memory_free,
        ( avg( memory_rss ) / 1048576)::int53 AS memory_rss,
        ( avg( fs_free ) / 1048576)::int53 AS fs_free
    FROM
        monitoring_instance_stats
    WHERE
        monitoring_instance_id = ?
        AND date >= date_trunc( 'hour', CURRENT_TIMESTAMP - INTERVAL '30 days' ) + INTERVAL '1 hour'
    GROUP BY
        date1
)
SELECT
    series.date,
    coalesce( cpu_user_delta, 0 ) AS cpu_user,
    coalesce( cpu_system_delta, 0 ) AS cpu_system,
    memory_free AS memory_free,
    memory_rss AS memory_rss,
    fs_free AS fs_free
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

        async API_getLatestTimeSeries ( ctx, monitoringInstanceId ) {
            return this.dbh.select( SQL.getLatestTimeSeries, [monitoringInstanceId] );
        }

        async API_getHistoricalTimeSeries ( ctx, monitoringInstanceId ) {
            return this.dbh.select( SQL.getHistoricalTimeSeries, [monitoringInstanceId] );
        }
    };
