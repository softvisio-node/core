import sql from "#lib/sql";

export default sql`

-- user
CREATE TABLE "user" (
    id serial8 PRIMARY KEY,
    email text NOT NULL UNIQUE,
    roles json,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity timestamptz,
    enabled bool NOT NULL DEFAULT TRUE,
    locale text,
    email_confirmed bool NOT NULL DEFAULT FALSE,
    gravatar text,
    telegram_username text UNIQUE,
    telegram_user_id int8 UNIQUE
);

CREATE TABLE user_password_hash (
    user_id int8 PRIMARY KEY REFERENCES "user" ( id ) ON DELETE CASCADE,
    hash text NOT NULL
);


CREATE FUNCTION user_before_insert_trigger() RETURNS TRIGGER AS $$
BEGIN

    NEW.gravatar = md5 ( lower ( NEW.email ) );
    NEW.email_confirmed = FALSE;
    NEW.telegram_user_id = NULL;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_before_insert BEFORE INSERT ON "user" FOR EACH ROW EXECUTE FUNCTION user_before_insert_trigger();

CREATE FUNCTION user_after_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/user/delete', json_build_object(
        'id', OLD.id::text
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_after_delete AFTER DELETE ON "user" FOR EACH ROW EXECUTE FUNCTION user_after_delete_trigger();

    -- XXX drop email_confirmed on email updated
    -- XXX on telegram username update - link telegram id

CREATE FUNCTION user_after_updte_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/user/update', json_build_object(
        'id', NEW.id::text,
        'email', NEW.email,
        'enabled', NEW.enabled,
        'locale', NEW.locale,
        'email_confirmed', NEW.email_confirmed,
        'telegram_username', NEW.telegram_username,
        'telegram_user_id', NEW.telegram_username::text
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_after_update AFTER UPDATE OF email, enabled, locale, email_confirmed, telegram_username, telegram_user_id ON "user" FOR EACH ROW EXECUTE FUNCTION user_after_dupdate_trigger();

CREATE FUNCTION user_password_hash_after_updte_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/user-password-hash/update', json_build_object(
        'id', NEW.user_id::text,
        'hash', NEW.hash
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_password_hash_after_update AFTER UPDATE ON user_password_hash FOR EACH ROW EXECUTE FUNCTION user_password_hash_after_dupdate_trigger();

`;
