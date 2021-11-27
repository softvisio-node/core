import sql from "#lib/sql";

export default sql`

DROP TRIGGER user_disabled ON "user";
DROP FUNCTION user_disabled_trigger;

CREATE FUNCTION user_enabled_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    -- remove user sessions
    IF NEW.enabled = FALSE THEN
        DELETE FROM user_session WHERE user_id = NEW.id;
    END IF;

    PERFORM pg_notify( 'api/user-enabled/update', json_build_object( 'user_id', NEW.id::text, 'enabled', NEW.enabled )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_enabled_after_update AFTER UPDATE OF enabled ON "user" FOR EACH ROW EXECUTE FUNCTION user_enabled_after_update_trigger();

DROP TRIGGER user_hash_hash_after_update ON user_hash;
DROP FUNCTION user_invalidate_hash_trigger;

CREATE FUNCTION user_hash_hash_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/user-password/update', json_build_object( 'user_id', NEW.user_id::text, 'username', ( SELECT name FROM "user" WHERE id = NEW.user_id ) )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_hash_hash_after_update AFTER UPDATE OF hash ON user_hash FOR EACH ROW EXECUTE FUNCTION user_hash_hash_after_update_trigger();

CREATE FUNCTION user_after_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/user/delete', json_build_object( 'user_id', OLD.user_id::text )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER user_after_delete ON "user";
CREATE TRIGGER user_after_delete AFTER DELETE ON "user" FOR EACH ROW EXECUTE FUNCTION user_after_delete_trigger();

DROP TRIGGER user_name_permissions_after_update ON "user";
DROP FUNCTION user_invalidate_trigger;

CREATE FUNCTION user_permissions_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/user-permissions/update', json_build_object( 'user_id', NEW.id::text )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_permissions_after_update AFTER UPDATE OF permissions ON "user" FOR EACH ROW EXECUTE FUNCTION user_permissions_after_update_trigger();

CREATE FUNCTION user_name_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/user-name/update', json_build_object( 'user_id', NEW.id::text )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_name_after_update AFTER UPDATE OF name ON "user" FOR EACH ROW EXECUTE FUNCTION user_name_after_update_trigger();

CREATE FUNCTION user_email_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/user-email/update', json_build_object( 'user_id', NEW.id::text, 'email', NEW.email )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_email_after_update AFTER UPDATE OF email ON "user" FOR EACH ROW EXECUTE FUNCTION user_email_after_update_trigger();

CREATE OR REPLACE FUNCTION user_telegram_username_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM user_telegram WHERE user_id = NEW.id;

    PERFORM pg_notify( 'api/user-telegram-username/update', json_build_object( 'user_id', NEW.id::text, 'telegram_username', NEW.telegram_username )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION user_notification_type_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    -- deleter
    IF NEW.user_id IS NULL THEN
        PERFORM pg_notify( 'api/user-notification-type/update', json_build_object( 'user_id', OLD.user_id::text, 'type', OLD.type )::text );

    -- updated
    ELSE
        PERFORM pg_notify( 'api/user-notification-type/update', json_build_object( 'user_id', NEW.user_id::text, 'type', NEW.type )::text );
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_notification_type_after_update AFTER INSERT OR UPDATE OR DELETE ON user_notification_type FOR EACH ROW EXECUTE FUNCTION user_notification_type_update_trigger();

`;
