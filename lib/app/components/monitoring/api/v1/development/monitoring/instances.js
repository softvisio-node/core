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
    coalesce( calls, 0 ) AS calls,
    coalesce( ( duration::float8 / calls )::float8, 0 ) AS duration_per_call,
    coalesce( ( exceptions::float8 / calls * 100 )::float8, 0 ) AS exceptions_percent
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

        async API_getLatestTimeSeries ( ctx, monitoringMethodId ) {
            return this.dbh.select( SQL.getLatestTimeSeries, [monitoringMethodId] );
        }

        async API_getHistoricalTimeSeries ( ctx, monitoringMethodId ) {
            return this.dbh.select( SQL.getHistoricalTimeSeries, [monitoringMethodId] );
        }
    };
