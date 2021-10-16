import sql from "#lib/sql";
import CONST from "#lib/const";

export default sql`

CREATE TABLE user_session (
    id serial8 PRIMARY KEY NOT NULL,
    user_id int8 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_session_hash (
    user_session_id int8 PRIMARY KEY NOT NULL REFERENCES user_session ( id ) ON DELETE CASCADE,
    hash text NOT NULL
);

CREATE FUNCTION user_session_invalidate_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify ( 'api/invalidate-user-token', ${CONST.AUTH_SESSION} || '/' || OLD.id::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_session_after_delete_trigger AFTER DELETE ON user_session FOR EACH ROW EXECUTE PROCEDURE user_session_invalidate_trigger();

`;
