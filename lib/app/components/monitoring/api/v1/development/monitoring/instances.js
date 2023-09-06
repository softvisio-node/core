import sql from "#lib/sql";

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
        AND date >= ( SELECT start FROM params )
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
                return this.dbh.select( SQL.getStats, ["60 minutes", "minute", instanceId] );
            }
            else {
                return this.dbh.select( SQL.getStats, ["30 days", "hour", instanceId] );
            }
        }
    };
