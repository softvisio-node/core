import sql from "#lib/sql";

export default sql`

DROP FUNCTION user_disabled_trigger;
CREATE FUNCTION user_enabled_after_update() RETURNS TRIGGER AS $$
BEGIN

    -- remove user sessions
    IF NEW.enabled = FALSE THEN
        DELETE FROM user_session WHERE user_id = NEW.id;
    END IF;

    PERFORM pg_notify( 'api/user-enabled/update', json_build_object( 'user_id', NEW.id::text, 'enabled', NEW.enabled )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER user_disabled ON "user";
CREATE TRIGGER user_enabled_after_update AFTER UPDATE OF enabled ON "user" FOR EACH ROW EXECUTE PROCEDURE user_enabled_after_update_trigger();

`;
