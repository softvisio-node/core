import sql from "#lib/sql";

export default sql`

CREATE SEQUENCE api_session_id_seq AS int8 MAXVALUE ${ Number.MAX_SAFE_INTEGER };

CREATE TABLE api_session (
    id int53 PRIMARY KEY DEFAULT nextval( 'api_session_id_seq' ),
    user_id int53 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires timestamptz NOT NULL,
    last_authorized timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    hostname text,
    remote_address text,
    geoip_name text,
    user_agent text,
    browser_family text,
    browser_version text,
    os_family text,
    os_version text,
    device_vendor text,
    device_model text
);

ALTER SEQUENCE api_session_id_seq OWNED BY api_session.id;

CREATE TABLE api_session_hash (
    api_session_id int53 PRIMARY KEY REFERENCES api_session ( id ) ON DELETE CASCADE,
    fingerprint int2 NOT NULL,
    hash text NOT NULL
);

-- after update
CREATE FUNCTION api_session_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/session/update', json_build_object(
        'id', NEW.id,
        'last_authorized', NEW.last_authorized,
        'remote_address', NEW.remote_address,
        'user_agent', NEW.user_agent
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER api_session_last_authorized_after_update AFTER UPDATE OF last_authorized, remote_address, user_agent ON api_session FOR EACH ROW EXECUTE FUNCTION api_session_after_update_trigger();

-- after delete
CREATE FUNCTION api_session_after_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/session/delete', json_build_object(
        'id', OLD.id
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER api_session_after_delete AFTER DELETE ON api_session FOR EACH ROW EXECUTE FUNCTION api_session_after_delete_trigger();

-- last activity
CREATE FUNCTION api_session_last_activity_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    UPDATE "user" SET last_activity = NEW.last_activity WHERE id = NEW.user_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER api_session_last_activity_after_update AFTER UPDATE OF last_activity ON api_session FOR EACH ROW EXECUTE FUNCTION api_session_last_activity_after_update_trigger();

`;
