import sql from "#lib/sql";

export default sql`

CREATE TABLE telegram_user (
    id int8 PRIMARY KEY, -- telegram user id / telegram chat id
    name text NOT NULL UNIQUE -- telegram username
);

CREATE FUNCTION telegram_user_after_insert_trigger() RETURNS TRIGGER AS $$
DECLARE
    _user record;
BEGIN
    SELECT id FROM "user" WHERE telegram_username = NEW.name INTO _user;

    IF _user IS NOT NULL THEN
        PERFORM pg_notify( 'api/user/update', json_build_object(
            'user_id', _user.id::text,
            'telegram_username', _user.telegram_username,
            'telegram_user_id', NEW.id::text
        )::text );
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_user_after_insert AFTER INSERT ON telegram_user FOR EACH ROW EXECUTE FUNCTION telegram_user_after_insert_trigger();

CREATE FUNCTION telegram_user_after_delete_trigger() RETURNS TRIGGER AS $$
DECLARE
    _user record;
BEGIN
    SELECT id FROM "user" WHERE telegram_username = OLD.name INTO _user;

    IF _user IS NOT NULL THEN
        PERFORM pg_notify( 'api/user/update', json_build_object(
            'user_id', _user.id::text,
            'telegram_username', _user.telegram_username,
            'telegram_user_id', NULL
        )::text );
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_user_after_delete AFTER DELETE ON telegram_user FOR EACH ROW EXECUTE FUNCTION telegram_user_after_delete_trigger();

`;
