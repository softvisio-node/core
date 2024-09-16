import sql from "#lib/sql";

export default sql`

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

        UPDATE
            telegram_bot_link
        SET
            total_banned_users = CASE
                WHEN NEW.banned THEN total_banned_users + 1
                ELSE total_banned_users - 1
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
        'subscribed', NEW.subscribed,
        'returned', NEW.returned,
        'banned', NEW.banned,
        'locale', NEW.locale
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

`;
