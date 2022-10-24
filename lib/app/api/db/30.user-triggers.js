import sql from "#lib/sql";

export default sql`

CREATE FUNCTION user_before_insert_trigger() RETURNS TRIGGER AS $$
BEGIN

    NEW.email_confirmed = FALSE;
    NEW.gravatar = md5 ( lower ( NEW.email ) );
    NEW.telegram_user_id = NULL;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_before_insert BEFORE INSERT ON "user" FOR EACH ROW EXECUTE FUNCTION user_before_insert_trigger();

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

CREATE FUNCTION user_email_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    IF OLD.email != NEW.email THEN

        UPDATE "user" SET gravatar = md5 ( lower ( NEW.email ) );

        PERFORM pg_notify( 'api/user-email/update', json_build_object(
            'user_id', NEW.id::text,
            'email', NEW.email
        )::text );

    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_email_after_update AFTER UPDATE OF email ON "user" FOR EACH ROW EXECUTE FUNCTION user_email_after_update_trigger();

`;
