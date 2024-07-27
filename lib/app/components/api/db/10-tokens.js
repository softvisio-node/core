import sql from "#lib/sql";

export default sql`

CREATE EXTENSION IF NOT EXISTS softvisio_types;

CREATE SEQUENCE api_token_id_seq AS int8 MAXVALUE ${ Number.MAX_SAFE_INTEGER };

CREATE TABLE api_token (
    id int53 PRIMARY KEY DEFAULT nextval( 'api_token_id_seq' ),
    user_id int53 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    name text,
    enabled bool NOT NULL DEFAULT TRUE,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity timestamptz
);

ALTER SEQUENCE api_token_id_seq OWNED BY api_token.id;

CREATE TABLE api_token_hash (
    api_token_id int53 PRIMARY KEY REFERENCES api_token ( id ) ON DELETE CASCADE,
    fingerprint int2 NOT NULL,
    hash text NOT NULL
);

-- after update
CREATE FUNCTION api_token_after_update_trigger() RETURNS TRIGGER AS $$
DECLARE
    data jsonb;
BEGIN

    IF OLD.enabled != NEW.enabled THEN
        data:= ( SELECT jsonb_set_lax( coalesce( data, '{}' ), '{enabled}', to_jsonb( NEW.enabled ), TRUE, 'use_json_null' ) );
    END IF;

    IF data IS NOT NULL THEN
        data:= ( SELECT jsonb_set( data, '{id}', to_jsonb( NEW.id ), TRUE ) );

       PERFORM pg_notify( 'api/token/update', data::text );
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER api_token_enabled_after_update AFTER UPDATE OF enabled ON api_token FOR EACH ROW EXECUTE FUNCTION api_token_after_update_trigger();

-- after delete
CREATE FUNCTION api_token_after_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/token/delete', json_build_object(
        'id', OLD.id
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
