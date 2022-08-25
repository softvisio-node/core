import sql from "#lib/sql";
import constants from "#lib/app/constants";

export default sql`

CREATE TABLE user_session_key (
    id serial8 PRIMARY KEY,
    user_id int8 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires timestamptz NOT NULL
    user_agent text NOT NULL,
    ip_address text NOT NULL
);

CREATE TABLE user_session_key_hash (
    user_session_key_id int8 PRIMARY KEY REFERENCES user_session_key ( id ) ON DELETE CASCADE,
    hash text NOT NULL
);

CREATE FUNCTION user_session_key_invalidate_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/invalidate-user-key', json_build_object( 'key_type', ${constants.tokenTypeUserSession}, 'key_id', OLD.id::text )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_session_key_after_delete AFTER DELETE ON user_session_key FOR EACH ROW EXECUTE FUNCTION user_session_key_invalidate_trigger();

-- last activity
CREATE FUNCTION user_session_key_last_activity_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    UPDATE "user" SET last_activity = NEW.last_activity WHERE id = NEW.user_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_session_key_last_activity_after_update AFTER UPDATE OF last_activity ON user_session_key FOR EACH ROW EXECUTE FUNCTION user_session_key_last_activity_after_update_trigger();

`;
