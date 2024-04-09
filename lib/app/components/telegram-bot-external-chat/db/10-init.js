import sql from "#lib/sql";

export default sql`

CREATE EXTENSION IF NOT EXISTS softvisio_types;

CREATE TABLE telegram_bot_external_chat (
    telegram_bot_id int53 PRIMARY KEY REFERENCES telegram_bot ( id ) ON DELETE CASCADE,
    chat_url text
);

CREATE FUNCTION telegram_bot_external_chat_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'telegram/telegram-bot-external-chat/update', json_build_object(
        'telegram_bot_id', NEW.telegram_bot_id,
        'chat_url', NEW.chat_url
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_external_chat_after_update AFTER UPDATE ON telegram_bot_external_chat FOR EACH ROW EXECUTE FUNCTION telegram_bot_external_chat_after_update_trigger();

`;
