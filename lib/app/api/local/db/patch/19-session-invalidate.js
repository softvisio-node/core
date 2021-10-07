import sql from "#lib/sql";

export default sql`

CREATE FUNCTION user_session_invalidate_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('api/invalidate-user-session', OLD.id::text);

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;


DROP TRIGGER user_session_after_delete_trigger ON user_session;

CREATE TRIGGER user_session_after_delete_trigger AFTER DELETE ON user_session FOR EACH ROW EXECUTE PROCEDURE user_session_invalidate_trigger();

`;
