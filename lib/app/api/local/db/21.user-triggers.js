import sql from "#lib/sql";

export default sql`

CREATE FUNCTION user_before_insert_trigger() RETURNS TRIGGER AS $$
BEGIN

    -- check, that name is unique in email column
    IF EXISTS ( SELECT FROM "user" WHERE email = NEW.name ) THEN
        RAISE EXCEPTION 'Email is not unique' USING ERRCODE = 'unique_violation';
    END IF;

    -- check, that email is unique in name column
    IF NEW.email IS NOT NULL AND EXISTS ( SELECT FROM "user" WHERE name = NEW.email ) THEN
        RAISE EXCEPTION 'Email is not unique' USING ERRCODE = 'unique_violation';
    END IF;

    NEW.email_confirmed = FALSE;
    NEW.gravatar = md5 ( lower ( NEW.email ) );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_before_insert BEFORE INSERT ON "user" FOR EACH ROW EXECUTE FUNCTION user_before_insert_trigger();

CREATE FUNCTION user_name_before_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    -- check, that "name" is unique in "email" column
    IF EXISTS ( SELECT FROM "user" WHERE email = NEW.name AND id != NEW.id ) THEN
        RAISE EXCEPTION 'Email is not unique' USING ERRCODE = 'unique_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_name_before_update BEFORE UPDATE OF name ON "user" FOR EACH ROW EXECUTE FUNCTION user_name_before_update_trigger();

CREATE FUNCTION user_email_before_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    -- check, that "email" is unique in "name" column
    IF NEW.email IS NOT NULL AND EXISTS ( SELECT FROM "user" WHERE name = NEW.email AND id != NEW.id ) THEN
        RAISE EXCEPTION 'Email is not unique' USING ERRCODE = 'unique_violation';
    END IF;

    DELETE FROM user_action_token WHERE email = OLD.email;

    NEW.email_confirmed = FALSE;
    NEW.gravatar = md5 ( lower ( NEW.email ) );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_email_before_update BEFORE UPDATE OF email ON "user" FOR EACH ROW EXECUTE FUNCTION user_email_before_update_trigger();

CREATE FUNCTION user_enabled_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    -- remove user sessions
    IF NEW.enabled = FALSE THEN
        DELETE FROM user_session WHERE user_id = NEW.id;
    END IF;

    PERFORM pg_notify( 'api/user-enabled/update', json_build_object(
        'user_id', NEW.id::text,
        'enabled', NEW.enabled
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_enabled_after_update AFTER UPDATE OF enabled ON "user" FOR EACH ROW EXECUTE FUNCTION user_enabled_after_update_trigger();

CREATE FUNCTION user_locale_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'api/user-locale/update', json_build_object(
        'user_id', NEW.id::text,
        'locale', NEW.locale
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_locale_after_update AFTER UPDATE OF locale ON "user" FOR EACH ROW EXECUTE FUNCTION user_locale_after_update_trigger();

CREATE FUNCTION user_after_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/user/delete', json_build_object(
        'user_id', OLD.id::text
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_after_delete AFTER DELETE ON "user" FOR EACH ROW EXECUTE FUNCTION user_after_delete_trigger();

CREATE FUNCTION user_roles_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/user-roles/update', json_build_object(
        'user_id', NEW.id::text
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_roles_after_update AFTER UPDATE OF roles ON "user" FOR EACH ROW EXECUTE FUNCTION user_roles_after_update_trigger();

CREATE FUNCTION user_name_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/user-name/update', json_build_object(
        'user_id', NEW.id::text
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_name_after_update AFTER UPDATE OF name ON "user" FOR EACH ROW EXECUTE FUNCTION user_name_after_update_trigger();

CREATE FUNCTION user_email_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/user-email/update', json_build_object(
        'user_id', NEW.id::text,
        'email', NEW.email
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_email_after_update AFTER UPDATE OF email ON "user" FOR EACH ROW EXECUTE FUNCTION user_email_after_update_trigger();

`;
