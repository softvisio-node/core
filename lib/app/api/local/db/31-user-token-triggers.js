import sql from "#lib/sql";

export default sql`

CREATE FUNCTION user_token_invalidate_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify ( 'api/invalidate-user-token', OLD.id::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_token_permissions_after_update_trigger AFTER UPDATE OF permissions ON user_token FOR EACH ROW EXECUTE PROCEDURE user_token_invalidate_trigger();

CREATE TRIGGER user_token_enabled_after_update_trigger AFTER UPDATE OF enabled ON user_token FOR EACH ROW WHEN (NEW.enabled = FALSE) EXECUTE PROCEDURE user_token_invalidate_trigger();

CREATE TRIGGER user_token_after_delete_trigger AFTER DELETE ON user_token FOR EACH ROW EXECUTE PROCEDURE user_token_invalidate_trigger();

`;
