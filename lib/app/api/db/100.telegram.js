import sql from "#lib/sql";

export default sql`

CREATE TABLE user_telegram (
    user_id int8 PRIMARY KEY REFERENCES "user" ( id ) ON DELETE CASCADE,
    chat_id text
);

CREATE FUNCTION user_telegram_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.chat_id IS NULL THEN
        PERFORM pg_notify( 'api/user-telegram-chat/update', json_build_object( 'user_id', OLD.user_id::text, 'chat_id', NULL )::text );
    ELSE
        PERFORM pg_notify( 'api/user-telegram-chat/update', json_build_object( 'user_id', NEW.user_id::text, 'chat_id', NEW.chat_id )::text );
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_telegram_after_update AFTER INSERT OR UPDATE OR DELETE ON user_telegram FOR EACH ROW EXECUTE FUNCTION user_telegram_after_update_trigger();

CREATE FUNCTION user_telegram_username_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM user_telegram WHERE user_id = NEW.id;

    PERFORM pg_notify( 'api/user-telegram-username/update', json_build_object(
        'user_id', NEW.id::text,
        'telegram_username', NEW.telegram_username
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_telegram_username_after_update AFTER UPDATE OF telegram_username ON "user" FOR EACH ROW EXECUTE FUNCTION user_telegram_username_after_update_trigger();

`;
