import sql from "#lib/sql";

export default sql`

DROP TRIGGER telegram_bot_user_after_update ON telegram_bot_user;

ALTER TABLE telegram_bot_user RENAME COLUMN banned TO enabled;

ALTER TABLE telegram_bot_user ALTER COLUMN enabled SET DEFAULT TRUE;

UPDATE telegram_bot_user SET enabled = NOT enabled;

ALTER TABLE telegram_bot RENAME COLUMN total_banned_users TO total_disabled_users;

ALTER TABLE telegram_bot_link RENAME COLUMN total_banned_users TO total_disabled_users;

CREATE OR REPLACE FUNCTION telegram_bot_user_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    -- subscribed changed
    IF NEW.subscribed != OLD.subscribed THEN

        UPDATE
            telegram_bot
        SET
            total_subscribed_users = CASE
                WHEN NEW.subscribed THEN total_subscribed_users + 1
                ELSE total_subscribed_users - 1
                END,
            total_unsubscribed_users = CASE
                WHEN NEW.subscribed THEN total_unsubscribed_users - 1
                ELSE total_unsubscribed_users + 1
                END,
            total_returned_users = CASE
                WHEN NOT NEW.returned THEN total_returned_users
                WHEN NEW.subscribed THEN total_returned_users + 1
                ELSE total_returned_users - 1
                END
        WHERE
            id = NEW.telegram_bot_id
        ;

        -- link
        UPDATE
            telegram_bot_link
        SET
            total_subscribed_users =
                CASE WHEN NEW.subscribed THEN total_subscribed_users + 1
                ELSE total_subscribed_users - 1
                END,
            total_unsubscribed_users = CASE
                WHEN NEW.subscribed THEN total_unsubscribed_users - 1
                ELSE total_unsubscribed_users + 1
                END,
            total_returned_users = CASE
                WHEN NOT NEW.returned THEN total_returned_users
                WHEN NEW.subscribed THEN total_returned_users + 1
                ELSE total_returned_users - 1
                END
        FROM
            telegram_bot_user_link
        WHERE
            telegram_bot_user_link.telegram_bot_id = NEW.telegram_bot_id
            AND telegram_bot_user_link.telegram_user_id = NEW.telegram_user_id
            AND telegram_bot_user_link.telegram_bot_link_id = telegram_bot_link.id
        ;

    END IF;

    -- enabled changed
    IF NEW.enabled != OLD.enabled THEN

        UPDATE
            telegram_bot
        SET
            total_disabled_users = CASE
                WHEN NEW.enabled THEN total_disabled_users - 1
                ELSE total_disabled_users + 1
                END
        WHERE
            id = NEW.telegram_bot_id;

        UPDATE
            telegram_bot_link
        SET
            total_disabled_users = CASE
                WHEN NEW.enabled THEN total_disabled_users - 1
                ELSE total_disabled_users + 1
                END
        FROM
            telegram_bot_user_link
        WHERE
            telegram_bot_user_link.telegram_bot_id = NEW.telegram_bot_id
            AND telegram_bot_user_link.telegram_user_id = NEW.telegram_user_id
            AND telegram_bot_user_link.telegram_bot_link_id = telegram_bot_link.id;

    END IF;

    PERFORM pg_notify( 'telegram/telegram-bot-user/' || NEW.telegram_bot_id || '/update', json_build_object(
        'id', NEW.telegram_user_id,
        'api_user_id', NEW.api_user_id,
        'subscribed', NEW.subscribed,
        'returned', NEW.returned,
        'enabled', NEW.enabled,
        'locale', NEW.locale
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_user_after_update AFTER UPDATE OF api_user_id, subscribed, enabled, locale ON telegram_bot_user FOR EACH ROW EXECUTE FUNCTION telegram_bot_user_after_update_trigger();

`;
