import sql from "#lib/sql";

export default sql`

CREATE TABLE api_call_load (
    method_id text NOT NULL,
    user_id int8 REFERENCES "user" ( id ) ON DELETE RESTRICT,
    started timestamptz NOT NULL,
    is_declined bool NOT NULL
);

CREATE INDEX api_call_load_started_idx ON api_call_load ( started );

CREATE TABLE api_call_log (
    method_id text NOT NULL,
    user_id int8 REFERENCES "user" ( id ) ON DELETE RESTRICT,
    started timestamptz NOT NULL,
    finished timestamptz NOT NULL,
    runtime int4 NOT NULL,
    is_error bool NOT NULL,
    is_exception bool NOT NULL,
    status int2 NOT NULL,
    status_text text NOT NULL
);

CREATE INDEX api_call_log_method_id_idx ON api_call_log ( method_id );
CREATE INDEX api_call_log_started_idx ON api_call_log ( started );
CREATE INDEX api_call_log_finished_idx ON api_call_log ( finished );
CREATE INDEX api_call_log_is_exception_idx ON api_call_log ( is_exception );

CREATE VIEW api_call_log_methods AS (
    SELECT method_id FROM api_call_load
    UNION
    SELECT method_id FROM api_call_log
);

CREATE MATERIALIZED VIEW api_call_log_latest AS (
    WITH series AS (
        SELECT
            *
        FROM
            generate_series(
                date_trunc( 'minute', CURRENT_TIMESTAMP - INTERVAL '59 minutes' ),
                date_trunc( 'minute', CURRENT_TIMESTAMP ),
                INTERVAL '1 minute'
            ) AS date,
            api_call_log_methods
    ),
    load AS (
        SELECT
            method_id,
            date_trunc( 'minute', started ) AS date,
            count( nullif( is_declined, TRUE ) ) AS total_accepted,
            count( nullif( is_declined, FALSE ) ) AS total_declined
        FROM
            api_call_load
        WHERE
            started > CURRENT_TIMESTAMP - INTERVAL '59 minutes'
            AND started <= CURRENT_TIMESTAMP
        GROUP BY
            method_id,
            date
    ),
    requests AS (
        SELECT
            method_id,
            date_trunc( 'minute', finished ) AS date,
            count(*) AS total_requests,
            count( nullif( is_exception, FALSE ) ) AS total_exceptions,
            ( avg( runtime ) / 1000 )::numeric( 10, 2 ) AS avg_runtime
        FROM
            api_call_log
        WHERE
            finished > CURRENT_TIMESTAMP - INTERVAL '59 minutes'
            AND finished <= CURRENT_TIMESTAMP
        GROUP BY
            method_id,
            date
    )
    SELECT
        series.method_id,
        series.date,
        load.total_accepted,
        load.total_declined,
        requests.avg_runtime,
        ( ( requests.total_exceptions::numeric / nullif( requests.total_requests, 0 ) ) * 100 )::numeric( 5, 2 ) AS errors_percent
    FROM
        series
        LEFT JOIN load ON ( series.method_id = load.method_id AND series.date = load.date )
        LEFT JOIN requests ON ( series.method_id = requests.method_id AND series.date = requests.date )
    ORDER BY
        method_id, date
);

CREATE MATERIALIZED VIEW api_call_log_historic AS (
    WITH series AS (
        SELECT
            *
        FROM
            generate_series(
                date_trunc( 'hour', CURRENT_TIMESTAMP - INTERVAL '29 days' ),
                date_trunc( 'hour', CURRENT_TIMESTAMP ),
                INTERVAL '1 hour'
            ) AS date,
            api_call_log_methods
    ),
    load AS (
        SELECT
            method_id,
            date_trunc( 'hour', started ) AS date,
            count( nullif( is_declined, TRUE ) ) AS total_accepted,
            count( nullif( is_declined, FALSE ) ) AS total_declined
        FROM
            api_call_load
        WHERE
            started > CURRENT_TIMESTAMP - INTERVAL '29 days'
            AND started <= CURRENT_TIMESTAMP
        GROUP BY
            method_id,
            date
    ),
    requests AS (
        SELECT
            method_id,
            date_trunc( 'hour', finished ) AS date,
            count(*) AS total_requests,
            count( nullif( is_exception, FALSE ) ) AS total_exceptions,
            ( avg( runtime ) / 1000 )::numeric( 10, 2 ) AS avg_runtime
        FROM
            api_call_log
        WHERE
            finished > CURRENT_TIMESTAMP - INTERVAL '29 days'
            AND finished <= CURRENT_TIMESTAMP
        GROUP BY
            method_id,
            date
    )
    SELECT
        series.method_id,
        series.date,
        load.total_accepted,
        load.total_declined,
        requests.avg_runtime,
        ( ( requests.total_exceptions::numeric / nullif( requests.total_requests, 0 ) ) * 100 )::numeric( 5, 2 ) AS errors_percent
    FROM
        series
        LEFT JOIN load ON ( series.method_id = load.method_id AND series.date = load.date )
        LEFT JOIN requests ON ( series.method_id = requests.method_id AND series.date = requests.date )
    ORDER BY
        method_id, date
);

CREATE INDEX api_call_log_historic_method_id_idx ON api_call_log_historic ( method_id );

CREATE TABLE api_call_log_updated (
    type text PRIMARY KEY,
    last_updated timestamp
);

CREATE FUNCTION get_api_call_log_latest () RETURNS SETOF api_call_log_latest AS $$
BEGIN
    IF NOT EXISTS ( SELECT FROM api_call_log_updated WHERE type = 'latest' AND last_updated IS NOT NULL AND last_updated > CURRENT_TIMESTAMP - INTERVAL '10 seconds' ) AND pg_try_advisory_xact_lock( 1, 1 ) THEN
        REFRESH MATERIALIZED VIEW api_call_log_latest;

        INSERT INTO api_call_log_updated ( type, last_updated ) VALUES ( 'latest', CURRENT_TIMESTAMP ) ON CONFLICT ( type ) DO UPDATE SET last_updated = CURRENT_TIMESTAMP;
    END IF;

    RETURN QUERY SELECT * FROM api_call_log_latest;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION get_api_call_log_historic ( _method_id text ) RETURNS SETOF api_call_log_historic AS $$
BEGIN
    IF NOT EXISTS ( SELECT FROM api_call_log_updated WHERE type = 'historic' AND last_updated IS NOT NULL AND last_updated > CURRENT_TIMESTAMP - INTERVAL '10 seconds' ) AND pg_try_advisory_xact_lock( 1, 2 ) THEN
        REFRESH MATERIALIZED VIEW api_call_log_historic;

        INSERT INTO api_call_log_updated ( type, last_updated ) VALUES ( 'historic', CURRENT_TIMESTAMP ) ON CONFLICT ( type ) DO UPDATE SET last_updated = CURRENT_TIMESTAMP;
    END IF;

    RETURN QUERY EXECUTE FORMAT( 'SELECT * FROM api_call_log_historic WHERE method_id = %s', quote_literal( _method_id ) );
END;
$$ LANGUAGE plpgsql;

`;
