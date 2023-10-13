import sql from "#lib/sql";

export default sql`

-- user
CREATE TABLE "user" (
    id serial8 PRIMARY KEY,
    email text NOT NULL UNIQUE,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity timestamptz,
    enabled bool NOT NULL DEFAULT TRUE,
    locale text,
    email_confirmed bool NOT NULL DEFAULT FALSE
);

CREATE TABLE user_password_hash (
    user_id int8 PRIMARY KEY REFERENCES "user" ( id ) ON DELETE CASCADE,
    hash text NOT NULL
);

-- before insert user
CREATE FUNCTION user_before_insert_trigger() RETURNS TRIGGER AS $$
BEGIN

    NEW.email_confirmed = FALSE;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_before_insert BEFORE INSERT ON "user" FOR EACH ROW EXECUTE FUNCTION user_before_insert_trigger();

-- after delete user
CREATE FUNCTION user_after_delete_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'users/user/delete', json_build_object(
        'id', OLD.id::text
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_after_delete AFTER DELETE ON "user" FOR EACH ROW EXECUTE FUNCTION user_after_delete_trigger();

-- before update user
CREATE FUNCTION user_before_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    IF OLD.email != NEW.email THEN
        NEW.email_confirmed = FALSE;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_before_update BEFORE UPDATE ON "user" FOR EACH ROW EXECUTE FUNCTION user_before_update_trigger();

-- after update user
CREATE FUNCTION user_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'users/user/update', json_build_object(
        'id', NEW.id::text,
        'email', NEW.email,
        'enabled', NEW.enabled,
        'locale', NEW.locale,
        'email_confirmed', NEW.email_confirmed
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_after_update AFTER UPDATE OF email, enabled, locale, email_confirmed ON "user" FOR EACH ROW EXECUTE FUNCTION user_after_update_trigger();

-- after update user password hash
CREATE FUNCTION user_password_hash_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'users/user-password-hash/update', json_build_object(
        'id', NEW.user_id::text,
        'password_hash', NEW.hash
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_password_hash_after_update AFTER UPDATE ON user_password_hash FOR EACH ROW EXECUTE FUNCTION user_password_hash_after_update_trigger();

`;
