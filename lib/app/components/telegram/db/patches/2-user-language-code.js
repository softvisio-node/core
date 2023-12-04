import sql from "#lib/sql";

export default sql`

DROP TRIGGER telegram_user_after_update ON telegram_user;

DROP FUNCTION telegram_user_after_update_trigger;

CREATE FUNCTION telegram_user_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'telegram/telegram-user/update', json_build_object(
        'id', NEW.id::text,
        'username', NEW.username,
        'first_name', NEW.first_name,
        'last_name', NEW.last_name,
        'phone', NEW.phone
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_user_after_update AFTER UPDATE OF username, first_name, last_name, phone ON telegram_user FOR EACH ROW EXECUTE FUNCTION telegram_user_after_update_trigger();

ALTER TABLE telegram_user DROP COLUMN language_code;

`;
