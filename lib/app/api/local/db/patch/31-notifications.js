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


DROP FUNCTION user_invalidate_hash_trigger;
CREATE FUNCTION user_hash_hash_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/user-password/update', json_build_object( 'user_id', NEW.user_id::text, 'username', ( SELECT name FROM "user" WHERE id = NEW.user_id ) )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER user_hash_hash_after_update ON user_hash;
CREATE TRIGGER user_hash_hash_after_update AFTER UPDATE OF hash ON user_hash FOR EACH ROW EXECUTE PROCEDURE user_hash_hash_after_update_trigger();

CREATE FUNCTION user_after_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/user/delete', json_build_object( 'user_id', OLD.user_id::text )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER user_after_delete ON "user";
CREATE TRIGGER user_after_delete AFTER DELETE ON "user" FOR EACH ROW EXECUTE PROCEDURE user_after_delete_trigger();

`;
