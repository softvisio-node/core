import sql from "#lib/sql";

export default sql`

CREATE TABLE telegram_bot_user_link (
    telegram_bot_user_id int8 NOT MULL REFERENCES telegram_bot_user ( id ) ON DELETE CASCADE,
    telegram_bot_link_id int8 NOT MULL REFERENCES telegram_bot_link ( id ) ON DELETE CASCADE,
    PRIMARY KEY ( telegram_bot_user_id, telegram_bot_link_id)
);

CREATE OR REPLACE FUNCTION _telegram_bot_user_subscribe_update( _user record, _new_user bool ) RETURNS VOID AS $$
BEGIN

    UPDATE
        telegram_bot
    SET
        last_user_created = CASE
                WHEN _new_user THEN CURRENT_TIMESTAMP
                ELSE last_user_created
                END,
       total_users = CASE
            WHEN _new_user THEN total_users + 1
            ELSE total_users
            END,
        total_subscribed_users = CASE
            WHEN _user.subscribed THEN total_subscribed_users + 1
            ELSE total_subscribed_users - 1
            END,
        total_unsubscribed_users = CASE
            WHEN _new_user THEN total_unsubscribed_users
            WHEN _user.subscribed THEN total_unsubscribed_users - 1
            ELSE total_unsubscribed_users + 1
            END,
        total_returned_users = CASE
            WHEN NOT _user.returned THEN total_returned_users
            WHEN _user.subscribed THEN total_returned_users + 1
            ELSE total_returned_users - 1
            END
    WHERE
        id = _user.telegram_bot_id;

    -- link
    UPDATE
        telegram_bot_link
    SET
        last_user_created = CASE
            WHEN _new_user THEN CURRENT_TIMESTAMP
            ELSE last_user_created
            END,
        total_users = CASE
            WHEN _new_user THEN total_users + 1
            ELSE total_users
            END,
        total_subscribed_users =
            CASE WHEN _user.subscribed THEN total_subscribed_users + 1
            ELSE total_subscribed_users - 1
            END,
        total_unsubscribed_users = CASE
            WHEN _new_user THEN total_unsubscribed_users
            WHEN _user.subscribed THEN total_unsubscribed_users - 1
            ELSE total_unsubscribed_users + 1
            END,
        total_returned_users = CASE
            WHEN NOT _user.returned THEN total_returned_users
            WHEN _user.subscribed THEN total_returned_users + 1
            ELSE total_returned_users - 1
            END
    FROM
        telegram_bot_user_link
    WHERE
        telegram_bot_user_link.telegram_bot_user_id = _user.id
        AND telegram_bot_user_link.telegram_bot_link_id = telegram_bot_link.id;

END;
$$ LANGUAGE plpgsql;

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
            telegram_bot_user_link.telegram_bot_user_id = MEW.id
            AND telegram_bot_user_link.telegram_bot_link_id = telegram_bot_link.id;

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

ALTER TABLE telegram_bot_user DROP COLUMN telegram_bot_link_id;

`;
