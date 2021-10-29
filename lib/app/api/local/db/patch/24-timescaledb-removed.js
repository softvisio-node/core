import sql from "#lib/sql";

export default sql`

DROP MATERIALIZED VIEW IF EXISTS api_call_log_stat_60_min;

CREATE MATERIALIZED VIEW api_call_log_stat_60_min AS (
    WITH
        _api_call_log_load AS (
            SELECT
                method_id,
                date_trunc( 'minute', started ) AS date,
                count( nullif( is_declined, TRUE ) ) AS total_accepted,
                count( nullif( is_declined, FALSE ) ) AS total_declined
            FROM
                api_call_load
            WHERE
                started > now() - INTERVAL '30 days'
                AND started <= now()
            GROUP BY
                method_id,
                date
            ORDER BY
                date,
                method_id
        ),

        _api_call_log_requests AS (
            SELECT
                method_id,
                date_trunc( 'minute', finished ) AS date,
                count(*) AS total_requests,
                count( nullif( is_exception, FALSE ) ) AS total_exceptions,
                ( avg( runtime ) / 1000 )::numeric( 10, 2 ) AS avg_runtime
            FROM
                api_call_log
            WHERE
                finished > now() - INTERVAL '30 days'
                AND finished <= now()
            GROUP BY
                method_id,
                date
            ORDER BY
                date,
                method_id
        )
    SELECT
        _api_call_log_methods.method_id,
        CURRENT_TIMESTAMP AS last_updated,
        (   SELECT json_agg( json_build_object(
                'date', date,
                'total_accepted', total_accepted,
                'total_declined', total_declined
            ) )
            FROM
                _api_call_log_load
            WHERE
                method_id = _api_call_log_methods.method_id
                AND date >= CURRENT_TIMESTAMP - INTERVAL '60 minutes'
        ) AS load,
        (   SELECT json_agg( json_build_object(
                'date', date,
                'exceptions_percent', ( ( total_exceptions::numeric / nullif( total_requests, 0 ) ) * 100 )::numeric( 5, 2 ),
                'avg_runtime', avg_runtime
            ) )
            FROM
                _api_call_log_requests
            WHERE
                method_id = _api_call_log_methods.method_id
                AND date >= CURRENT_TIMESTAMP - INTERVAL '60 minutes'
        ) AS requests
    FROM
        _api_call_log_methods
);

CREATE UNIQUE INDEX api_call_log_stat_60_min_id_key ON api_call_log_stat_60_min ( method_id );

DROP MATERIALIZED VIEW IF EXISTS api_call_log_stat_30_days;

CREATE MATERIALIZED VIEW api_call_log_stat_30_days AS (
    WITH
        _api_call_log_load AS (
            SELECT
                method_id,
                date_bin( '10 minutes', started, '0001-01-01' ) AS date,
                count( nullif( is_declined, TRUE ) ) AS total_accepted,
                count( nullif( is_declined, FALSE ) ) AS total_declined
            FROM
                api_call_load
            WHERE
                started > now() - INTERVAL '30 days'
                AND started <= now()
            GROUP BY
                method_id,
                date
            ORDER BY
                date,
                method_id
        ),

        _api_call_log_requests AS (
            SELECT
                method_id,
                date_bin( '10 minutes', finished, '0001-01-01' ) AS date,
                count(*) AS total_requests,
                count( nullif( is_exception, FALSE ) ) AS total_exceptions,
                ( avg( runtime ) / 1000 )::numeric( 10, 2 ) AS avg_runtime
            FROM
                api_call_log
            WHERE
                finished > now() - INTERVAL '30 days'
                AND finished <= now()
            GROUP BY
                method_id,
                date
            ORDER BY
                date,
                method_id
        )
    SELECT
        _api_call_log_methods.method_id,
        CURRENT_TIMESTAMP AS last_updated,
        (   SELECT json_agg( json_build_object(
                'date', date,
                'total_accepted', total_accepted,
                'total_declined', total_declined
            ) )
            FROM
                _api_call_log_load
            WHERE
                method_id = _api_call_log_methods.method_id
                AND date >= CURRENT_TIMESTAMP - INTERVAL '30 days'
        ) AS load,
        (   SELECT json_agg( json_build_object(
                'date', date,
                'exceptions_percent', ( ( total_exceptions::numeric / nullif( total_requests, 0 ) ) * 100 )::numeric( 5, 2 ),
                'avg_runtime', avg_runtime
            ) )
            FROM
                _api_call_log_requests
            WHERE
                method_id = _api_call_log_methods.method_id
                AND date >= CURRENT_TIMESTAMP - INTERVAL '30 days'
        ) AS requests
    FROM
        _api_call_log_methods
);

CREATE UNIQUE INDEX api_call_log_stat_30_days_id_key ON api_call_log_stat_30_days ( method_id );

`;
