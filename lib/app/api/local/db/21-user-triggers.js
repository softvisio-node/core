import sql from "#lib/sql";

export default sql`

CREATE FUNCTION user_before_insert_trigger() RETURNS TRIGGER AS $$
BEGIN

    -- check, that name is unique in email column
    IF EXISTS ( SELECT 1 FROM "user" WHERE email = NEW.name ) THEN
        RAISE EXCEPTION 'Email is not unique';
    END IF;

    -- check, that email is unique in name column
    IF NEW.email IS NOT NULL AND EXISTS ( SELECT 1 FROM "user" WHERE name = NEW.email ) THEN
        RAISE EXCEPTION 'Email is not unique';
    END IF;

    NEW.email_confirmed = FALSE;
    NEW.gravatar = md5 ( lower ( NEW.email ) );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_before_insert BEFORE INSERT ON "user" FOR EACH ROW EXECUTE PROCEDURE user_before_insert_trigger();

CREATE OR REPLACE FUNCTION user_name_before_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    -- check, that "name" is unique in "email" column
    IF EXISTS ( SELECT 1 FROM "user" WHERE email = NEW.name AND id != NEW.id ) THEN
        RAISE EXCEPTION 'Email is not unique';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_name_before_update BEFORE UPDATE OF name ON "user" FOR EACH ROW EXECUTE PROCEDURE user_name_before_update_trigger();

CREATE OR REPLACE FUNCTION user_email_before_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    -- check, that "email" is unique in "name" column
    IF NEW.email IS NOT NULL AND EXISTS ( SELECT 1 FROM "user" WHERE name = NEW.email AND id != NEW.id ) THEN
        RAISE EXCEPTION 'Email is not unique';
    END IF;

    DELETE FROM user_action_token WHERE email = OLD.email;

    NEW.email_confirmed = FALSE;
    NEW.gravatar = md5 ( lower ( NEW.email ) );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_email_before_update BEFORE UPDATE OF email ON "user" FOR EACH ROW EXECUTE PROCEDURE user_email_before_update_trigger();

CREATE FUNCTION user_invalidate_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/invalidate-user', json_build_object( 'id', OLD.id::text )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_name_permissions_after_update AFTER UPDATE OF name, permissions ON "user" FOR EACH ROW EXECUTE PROCEDURE user_invalidate_trigger();

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

CREATE TRIGGER user_enabled_after_update AFTER UPDATE OF enabled ON "user" FOR EACH ROW EXECUTE PROCEDURE user_enabled_after_update_trigger();

CREATE FUNCTION user_hash_hash_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/user-password/update', json_build_object( 'user_id', NEW.user_id::text, 'username', ( SELECT name FROM "user" WHERE id = NEW.user_id ) )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_hash_hash_after_update AFTER UPDATE OF hash ON user_hash FOR EACH ROW EXECUTE PROCEDURE user_hash_hash_after_update_trigger();

CREATE FUNCTION user_after_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/user/delete', json_build_object( 'user_id', OLD.user_id::text )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_after_delete AFTER DELETE ON "user" FOR EACH ROW EXECUTE PROCEDURE user_after_delete_trigger();

`;
