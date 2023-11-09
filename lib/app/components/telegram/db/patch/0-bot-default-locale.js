import sql from "#lib/sql";

export default sql`

ALTER TABLE telegram_bot
    ADD COLUMN default_locale text,
    ADD COLUMN detect_locale_by_client_language bool NOT NULL DEFAULT TRUE;

DROP TRIGGER telegram_bot_locales_after_update ON telegram_bot;

DROP FUNCTION telegram_bot_locales_after_update_trigger;

CREATE FUNCTION telegram_bot_locales_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'telegram/telegram-bot/update', json_build_object(
        'id', NEW.id::text,
        'locales', NEW.locales,
        'default_locale', NEW.default_locale,
        'detect_locale_by_client_language', NEW.detect_locale_by_client_language
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_locales_after_update AFTER UPDATE OF locales, default_locale, detect_locale_by_client_language ON telegram_bot FOR EACH ROW EXECUTE FUNCTION telegram_bot_locales_after_update_trigger();

`;
