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
    ( memory_used / 1048576 )::int53 AS memory_used,
    memory_used_percent,
    ( memory_rss / 1048576 )::int53 AS memory_rss,
    memory_rss_percent,
    ( fs_used / 1048576 )::int53 AS fs_used,
    fs_used_percent
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
        ( avg( memory_used ) / 1048576)::int53 AS memory_used,
        avg( memory_used_percent )::number2 AS memory_used_percent,
        ( avg( memory_rss ) / 1048576)::int53 AS memory_rss,
        avg( memory_rss_percent )::number2 AS memory_rss_percent,
        ( avg( fs_used ) / 1048576)::int53 AS fs_used,
        avg( fs_used_percent )::number2 AS fs_used_percent
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
    memory_used,
    memory_used_percent,
    memory_rss,
    memory_rss_percent,
    fs_used,
    fs_used_percent
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
            if ( period === "1 hour" ) {
                return this.dbh.select( SQL.getLatestTimeSeries, [instanceId] );
            }
            else {
                return this.dbh.select( SQL.getHistoricalTimeSeries, [instanceId] );
            }
        }
    };
