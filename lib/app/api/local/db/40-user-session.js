import sql from "#lib/sql";
import constants from "#lib/app/constants";

export default sql`

CREATE TABLE user_session (
    id serial8 PRIMARY KEY NOT NULL,
    user_id int8 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_session_hash (
    user_session_id int8 PRIMARY KEY NOT NULL REFERENCES user_session ( id ) ON DELETE CASCADE,
    hash text NOT NULL
);

CREATE FUNCTION user_session_invalidate_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/invalidate-user-token', json_build_object( 'token_type', ${constants.tokenTypeUserSession}, 'token_id', OLD.id::text )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_session_after_delete AFTER DELETE ON user_session FOR EACH ROW EXECUTE FUNCTION user_session_invalidate_trigger();

-- last activity
CREATE FUNCTION user_session_last_activity_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    UPDATE "user" SET last_activity = NEW.last_activity WHERE id = NEW.user_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_session_last_activity_after_update AFTER UPDATE OF last_activity ON user_session FOR EACH ROW EXECUTE FUNCTION user_session_last_activity_after_update_trigger();

`;
