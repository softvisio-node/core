import sql from "#lib/sql";

export default sql`

CREATE TABLE telegram_bot_user (
    id serial8 PRIMARY KEY,
    telegram_bot_id int8 NOT NULL REFERENCES telegram_bot ( id ) ON DELETE CASCADE,
    telegram_user_id int8 NOT NULL REFERENCES telegram_user ( id ) ON DELETE RESTRICT,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    subscribed bool NOT NULL DEFAULT TRUE,
    returned bool NOT NULL DEFAULT FALSE,
    banned bool NOT NULL DEFAULT FALSE,
    subscribed_date timestamptz,
    unsubscribed_date timestamptz,
    state json NOT NULL DEFAULT '{}',
    locale text,
    UNIQUE ( telegram_bot_id, telegram_user_id )
);

CREATE TABLE telegram_bot_user_link (
    telegram_bot_user_id int8 NOT MULL REFERENCES telegram_bot_user ( id ) ON DELETE CASCADE,
    telegram_bot_link_id int8 NOT MULL REFERENCES telegram_bot_link ( id ) ON DELETE CASCADE,
    PRIMARY KEY ( telegram_bot_user_id, telegram_bot_link_id)
);

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

    UPDATE
        telegram_bot
    SET
        last_user_created = CURRENT_TIMESTAMP,
        total_users = total_users + 1,
        total_subscribed_users = total_subscribed_users + 1
    WHERE
        id = NEW.telegram_bot_id
    ;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_user_after_insert AFTER INSERT ON telegram_bot_user FOR EACH ROW EXECUTE FUNCTION telegram_bot_user_after_insert_trigger();

--- before update
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
-- XXX
CREATE FUNCTION telegram_bot_user_after_update_trigger() RETURNS TRIGGER AS $$
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
            telegram_bot_user_link.telegram_bot_user_id = NEW.id
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

CREATE TRIGGER telegram_bot_user_after_update AFTER UPDATE OF subscribed, banned, locale ON telegram_bot_user FOR EACH ROW EXECUTE FUNCTION telegram_bot_user_after_update_trigger();








-- XXX log new users
CREATE FUNCTION telegram_bot_user_link_after_insert_trigger() RETURNS TRIGGER AS $$
BEGIN

    UPDATE
        telegram_bot_link
    SET
        last_user_created = CURRENT_TIMESTAMP,
        total_users = total_users + 1,
        total_subscribed_users = total_subscribed_users + 1
    WHERE
        id = NEW.telegram_bot_link_id
    ;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_user_link_after_insert AFTER INSERT ON telegram_bot_user_link FOR EACH ROW EXECUTE FUNCTION telegram_bot_user_link_after_insert_trigger();

`;
