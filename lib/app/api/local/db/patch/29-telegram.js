import sql from "#lib/sql";

export default sql`

CREATE OR REPLACE FUNCTION user_telegram_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.chat_id IS NULL THEN
        PERFORM pg_notify( 'api/user-telegram-chat-id/update', json_build_object( 'user_id', OLD.user_id::text, 'chat_id', OLD.chat_id )::text );
    ELSE
        PERFORM pg_notify( 'api/user-telegram/update', json_build_object( 'user_id', NEW.user_id::text, 'chat_id', NEW.chat_id )::text );
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

`;
