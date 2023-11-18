import sql from "#lib/sql";

export default sql`

ALTER TABLE telegram_user ADD COLUMN api_user_id int8 UNIQUE REFERENCES "user" ( id ) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION telegram_user_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'telegram/telegram-user/update', json_build_object(
        'api_user_id', NEW.api_user_id::text,
        'id', NEW.id::text,
        'username', NEW.username,
        'first_name', NEW.first_name,
        'last_name', NEW.last_name,
        'phone', NEW.phone
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER telegram_user_after_update ON telegram_user;

CREATE TRIGGER telegram_user_after_update AFTER UPDATE OF api_user_id, username, first_name, last_name, phone ON telegram_user FOR EACH ROW EXECUTE FUNCTION telegram_user_after_update_trigger();

CREATE OR REPLACE FUNCTION telegram_bot_user_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    -- subscribed changed
    IF NEW.subscribed != OLD.subscribed THEN

        PERFORM _telegram_bot_user_subscribe_update( NEW, FALSE );

    END IF;

    -- banned changed
    IF NEW.banned != OLD.banned THEN

        UPDATE
            telegram_bot
        SET
            total_banned_users = CASE
                WHEN NEW.banned THEN total_banned_users + 1
                ELSE total_banned_users - 1
                END
        WHERE
            id = NEW.telegram_bot_id;

        IF NEW.telegram_bot_link_id IS NOT NULL THEN

            UPDATE
                telegram_bot_link
            SET
                total_banned_users = CASE
                    WHEN NEW.banned THEN total_banned_users + 1
                    ELSE total_banned_users - 1
                    END
            WHERE
                id = NEW.telegram_bot_link_id;

        END IF;

    END IF;

    PERFORM pg_notify( 'telegram/telegram-bot-user/' || NEW.telegram_bot_id || '/update', json_build_object(
        'id', NEW.id::text,
        'subscribed', NEW.subscribed,
        'returned', NEW.returned,
        'banned', NEW.banned,
        'locale', NEW.locale
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER telegram_bot_user_after_update ON telegram_bot_user;

CREATE TRIGGER telegram_bot_user_after_update AFTER UPDATE OF subscribed, banned, locale ON telegram_bot_user FOR EACH ROW EXECUTE FUNCTION telegram_bot_user_after_update_trigger();

ALTER TABLE telegram_bot_user DROP CONSTRAINT telegram_bot_user_telegram_bot_id_api_user_id_key;

ALTER TABLE telegram_bot_user DROP COLUMN api_user_id;

`;
