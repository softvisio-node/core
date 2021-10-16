import sql from "#lib/sql";
import CONST from "#lib/const";

export default sql`

CREATE FUNCTION user_session_invalidate_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify ( 'api/invalidate-user-token', ${CONST.AUTH_SESSION} || '/' || OLD.id::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_session_after_delete_trigger AFTER DELETE ON user_session FOR EACH ROW EXECUTE PROCEDURE user_session_invalidate_trigger();

`;
