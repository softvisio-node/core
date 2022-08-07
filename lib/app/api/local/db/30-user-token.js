import sql from "#lib/sql";
import constants from "#lib/app/constants";

export default sql`

CREATE TABLE user_token (
    id serial8 PRIMARY KEY,
    user_id int8 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    roles json,
    name text,
    enabled bool NOT NULL DEFAULT TRUE,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity timestamptz
);

CREATE TABLE user_token_hash (
    user_token_id int8 PRIMARY KEY REFERENCES user_token ( id ) ON DELETE CASCADE,
    hash text NOT NULL
);

CREATE FUNCTION user_token_invalidate_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/invalidate-user-token', json_build_object( 'token_type', ${constants.tokenTypeUserToken}, 'token_id', OLD.id::text )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_token_roles_after_update AFTER UPDATE OF roles ON user_token FOR EACH ROW EXECUTE FUNCTION user_token_invalidate_trigger();

CREATE TRIGGER user_token_enabled_after_update AFTER UPDATE OF enabled ON user_token FOR EACH ROW WHEN ( NEW.enabled = FALSE ) EXECUTE FUNCTION user_token_invalidate_trigger();

CREATE TRIGGER user_token_after_delete AFTER DELETE ON user_token FOR EACH ROW EXECUTE FUNCTION user_token_invalidate_trigger();

-- last activity
CREATE FUNCTION user_token_last_activity_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    UPDATE "user" SET last_activity = NEW.last_activity WHERE id = NEW.user_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_token_last_activity_after_update AFTER UPDATE OF last_activity ON user_token FOR EACH ROW EXECUTE FUNCTION user_token_last_activity_after_update_trigger();

`;
