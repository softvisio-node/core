import sql from "#lib/sql";
import CONST from "#lib/const";

export default sql`

CREATE TABLE user_token (
    id serial8 PRIMARY KEY NOT NULL,
    user_id int8 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    permissions jsonb NOT NULL,
    name text,
    enabled bool NOT NULL DEFAULT TRUE,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_token_hash (
    user_token_id int8 PRIMARY KEY NOT NULL REFERENCES user_token ( id ) ON DELETE CASCADE,
    hash text NOT NULL
);

CREATE FUNCTION user_token_invalidate_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/invalidate-user-token', json_build_object( 'token_type', ${CONST.AUTH_TOKEN}, 'token_id', OLD.id::text )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_token_permissions_after_update AFTER UPDATE OF permissions ON user_token FOR EACH ROW EXECUTE FUNCTION user_token_invalidate_trigger();

CREATE TRIGGER user_token_enabled_after_update AFTER UPDATE OF enabled ON user_token FOR EACH ROW WHEN ( NEW.enabled = FALSE ) EXECUTE FUNCTION user_token_invalidate_trigger();

CREATE TRIGGER user_token_after_delete AFTER DELETE ON user_token FOR EACH ROW EXECUTE FUNCTION user_token_invalidate_trigger();

`;
