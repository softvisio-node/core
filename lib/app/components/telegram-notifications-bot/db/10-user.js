import sql from "#lib/sql";

export default sql`

CREATE TABLE telegram_notifications_bot_user (
    id serial8 PRIMARY KEY REFERENCES telegram_bot_user ( id ) ON DELETE CASCADE,
    user_id int8 UNIQUE REFERENCES "user" ( id ) ON DELETE SET NULL
);

-- after insert
CREATE FUNCTION telegram_notifications_bot_user_after_insert_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'telegram-notifications-bot/telegram-notifications-bot-user/update', json_build_object(
        'id', NEW.id::text,
        'user_id', NEW.user_id::text
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_notifications_bot_user_after_insert AFTER INSERT ON telegram_notifications_bot_user FOR EACH ROW EXECUTE FUNCTION telegram_notifications_bot_user_after_insert_trigger();

-- after update
CREATE FUNCTION telegram_notifications_bot_user_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'telegram-notifications-bot/telegram-notifications-bot-user/update', json_build_object(
        'id', NEW.id::text,
        'user_id', NEW.user_id::text
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_notifications_bot_user_after_update AFTER UPDATE ON telegram_notifications_bot_user FOR EACH ROW EXECUTE FUNCTION telegram_notifications_bot_user_after_update_trigger();

-- after delete
CREATE FUNCTION telegram_notifications_bot_user_after_delete_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'telegram-notifications-bot/telegram-notifications-bot-user/update', json_build_object(
        'id', OLD.id::text,
        'user_id', OLD.user_id::text
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_notifications_bot_user_after_delete AFTER DELETE ON telegram_notifications_bot_user FOR EACH ROW EXECUTE FUNCTION telegram_notifications_bot_user_after_delete_trigger();

`;
