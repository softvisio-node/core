import sql from "#lib/sql";

export default sql`

CREATE FUNCTION user_token_last_activity_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    UPDATE "user" SET last_activity = NEW.last_activity WHERE id = NEW.user_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_token_last_activity_after_update AFTER UPDATE OF last_activity ON user_token FOR EACH ROW EXECUTE FUNCTION user_token_last_activity_after_update_trigger();

CREATE FUNCTION user_session_last_activity_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    UPDATE "user" SET last_activity = NEW.last_activity WHERE id = NEW.user_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_session_last_activity_after_update AFTER UPDATE OF last_activity ON user_session FOR EACH ROW EXECUTE FUNCTION user_session_last_activity_after_update_trigger();

`;
