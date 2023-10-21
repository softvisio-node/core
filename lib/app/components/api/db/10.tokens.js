import sql from "#lib/sql";

export default sql`

CREATE TABLE api_token (
    id serial8 PRIMARY KEY,
    user_id int8 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    name text,
    enabled bool NOT NULL DEFAULT TRUE,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity timestamptz
);

CREATE TABLE api_token_hash (
    api_token_id int8 PRIMARY KEY REFERENCES api_token ( id ) ON DELETE CASCADE,
    fingerprint int2 NOT NULL,
    hash text NOT NULL
);

-- after update
CREATE FUNCTION api_token_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    IF OLD.enabled != NEW.enabled THEN
        PERFORM pg_notify( 'api/token/enabled/update', json_build_object(
            'id', NEW.id::text,
            'enabled', NEW.enabled
        )::text );
    END IF;

    PERFORM pg_notify( 'api/token/update', json_build_object(
        'id', NEW.id::text,
        'enabled', NEW.enabled
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER api_token_enabled_after_update AFTER UPDATE OF enabled ON api_token FOR EACH ROW EXECUTE FUNCTION api_token_after_update_trigger();

-- after delete
CREATE FUNCTION api_token_after_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/token/delete', json_build_object(
        'id', OLD.id::text
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER api_token_after_delete AFTER DELETE ON api_token FOR EACH ROW EXECUTE FUNCTION api_token_after_delete_trigger();

-- last activity
CREATE FUNCTION api_token_last_activity_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    UPDATE "user" SET last_activity = NEW.last_activity WHERE id = NEW.user_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER api_token_last_activity_after_update AFTER UPDATE OF last_activity ON api_token FOR EACH ROW EXECUTE FUNCTION api_token_last_activity_after_update_trigger();

`;
