import sql from "#lib/sql";

export default sql`

ALTER TABLE api_session ADD COLUMN geoip_name text;

CREATE OR REPLACE FUNCTION api_session_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/session/update', json_build_object(
        'id', NEW.id,
        'last_authorized', NEW.last_authorized,
        'remote_address', NEW.remote_address,
        'geoip_name', NEW.geoip_name,
        'user_agent', NEW.user_agent
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER api_session_last_authorized_after_update AFTER UPDATE OF last_authorized, remote_address, geoip_name, user_agent ON api_session FOR EACH ROW EXECUTE FUNCTION api_session_after_update_trigger();

`;
