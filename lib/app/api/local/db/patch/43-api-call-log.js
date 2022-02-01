import sql from "#lib/sql";

export default sql`

CREATE OR REPLACE FUNCTION get_api_call_log_historic ( _method_id text ) RETURNS SETOF api_call_log_historic AS $$
BEGIN
    IF NOT EXISTS ( SELECT FROM api_call_log_updated WHERE type = 'historic' AND last_updated IS NOT NULL AND last_updated > CURRENT_TIMESTAMP - INTERVAL '10 seconds' ) AND pg_try_advisory_xact_lock( 1, 2 ) THEN
        REFRESH MATERIALIZED VIEW api_call_log_historic;

        INSERT INTO api_call_log_updated ( type, last_updated ) VALUES ( 'historic', CURRENT_TIMESTAMP ) ON CONFLICT ( type ) DO UPDATE SET last_updated = CURRENT_TIMESTAMP;
    END IF;

    RETURN QUERY EXECUTE FORMAT( 'SELECT * FROM api_call_log_historic WHERE method_id = %s', quote_literal( _method_id ) );
END;
$$ LANGUAGE plpgsql;

`;
