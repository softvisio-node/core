import sql from "#lib/sql";

export default sql`

CREATE TABLE user_telegram (
    user_id int8 PRIMARY KEY NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    chat_id text
);

CREATE TABLE user_notification_type (
    id serial8 PRIMARY KEY NOT NULL,
    user_id int8 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    type text NOT NULL,
    internal bool,
    email bool,
    telegram bool,
    push bool,
    UNIQUE ( user_id, type )
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

CREATE TRIGGER user_telegram_after_update AFTER INSERT OR UPDATE OR DELETE ON user_telegram FOR EACH ROW EXECUTE PROCEDURE user_telegram_after_update_trigger();

CREATE FUNCTION user_telegram_username_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM user_telegram WHERE user_id = NEW.id;

    PERFORM pg_notify( 'api/user-telegram-username/update', json_build_object( 'user_id', NEW.id::text, 'telegram_username', NEW.telegram_username )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_telegram_username_after_update AFTER UPDATE OF telegram_username ON "user" FOR EACH ROW EXECUTE PROCEDURE user_telegram_username_after_update_trigger();

CREATE FUNCTION user_notification_type_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    -- deleter
    IF NEW.user_id IS NULL THEN
        PERFORM pg_notify( 'api/user-notification-type/update', json_build_object( 'user_id', OLD.user_id::text, 'type', OLD.type )::text );

    -- updated
    ELSE
        PERFORM pg_notify( 'api/user-notification-type/update', json_build_object( 'user_id', NEW.user_id::text, 'type', NEW.type )::text );
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_notification_type_after_update AFTER INSERT OR UPDATE OR DELETE ON user_notification_type FOR EACH ROW EXECUTE PROCEDURE user_notification_type_update_trigger();

`;
