import sql from "#lib/sql";

export default sql`

CREATE TABLE telegram_bot_user (
    id serial8 PRIMARY KEY,
    telegram_bot_id int8 NOT NULL REFERENCES telegram_bot ( id ) ON DELETE CASCADE,
    telegram_user_id int8 NOT NULL REFERENCES telegram_user ( id ) ON DELETE RESTRICT,
    telegram_bot_link_id int8 REFERENCES telegram_bot_link ( id ) ON DELETE SET NULL,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    api_user_id int8 REFERENCES "user" ( id ) ON DELETE SET NULL,
    subscribed bool NOT NULL DEFAULT TRUE,
    returned bool NOT NULL DEFAULT FALSE,
    banned bool NOT NULL DEFAULT FALSE,
    subscribed_date timestamptz,
    unsubscribed_date timestamptz,
    state json NOT NULL DEFAULT '{}',
    locale text,
    UNIQUE ( telegram_bot_id, telegram_user_id ),
    UNIQUE ( telegram_bot_id, api_user_id )
);

CREATE FUNCTION _telegram_bot_user_subscribe_update( _user record, _new_user bool ) RETURNS VOID AS $$
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
    IF _user.telegram_bot_link_id THEN

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
        WHERE
            id = _user.telegram_bot_link_id;

    END IF;

END;
$$ LANGUAGE plpgsql;

--- befire insert
CREATE FUNCTION telegram_bot_user_before_insert_trigger() RETURNS TRIGGER AS $$
BEGIN

    -- subscribed changed
    IF NEW.subscribed THEN
        NEW.subscribed_date = CURRENT_TIMESTAMP;
    ELSE
        NEW.unsubscribed_date = CURRENT_TIMESTAMP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_user_before_insert BEFORE INSERT ON telegram_bot_user FOR EACH ROW EXECUTE FUNCTION telegram_bot_user_before_insert_trigger();

-- after insert
CREATE FUNCTION telegram_bot_user_after_insert_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM _telegram_bot_user_subscribe_update( NEW, TRUE );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_user_after_insert AFTER INSERT ON telegram_bot_user FOR EACH ROW EXECUTE FUNCTION telegram_bot_user_after_insert_trigger();

--- befire update
CREATE FUNCTION telegram_bot_user_before_update_of_subscribed_trigger() RETURNS TRIGGER AS $$
BEGIN

    -- subscribed changed
    IF NEW.subscribed THEN
        NEW.returned = TRUE;
        NEW.subscribed_date = CURRENT_TIMESTAMP;
    ELSE
        NEW.unsubscribed_date = CURRENT_TIMESTAMP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_user_before_update_of_subscribed BEFORE UPDATE OF subscribed ON telegram_bot_user FOR EACH ROW EXECUTE FUNCTION telegram_bot_user_before_update_of_subscribed_trigger();

-- after update
CREATE FUNCTION telegram_bot_user_after_update_trigger() RETURNS TRIGGER AS $$
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

        IF NEW.telegram_bot_link_id THEN

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
        'api_user_id', NEW.api_user_id::text,
        'subscribed', NEW.subscribed,
        'returned', NEW.returned,
        'banned', NEW.banned,
        'locale', NEW.locale
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_user_after_update AFTER UPDATE OF api_user_id, subscribed, banned, locale ON telegram_bot_user FOR EACH ROW EXECUTE FUNCTION telegram_bot_user_after_update_trigger();

`;
