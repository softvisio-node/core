import sql from "#lib/sql";

export default sql`

CREATE TABLE telegram_bot_user (
    telegram_bot_id int53 NOT NULL REFERENCES telegram_bot ( id ) ON DELETE CASCADE,
    telegram_user_id int53 NOT NULL REFERENCES telegram_user ( id ) ON DELETE RESTRICT,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    api_user_id int53 REFERENCES "user" ( id ) ON DELETE RESTRICT,
    subscribed bool NOT NULL DEFAULT TRUE,
    returned bool NOT NULL DEFAULT FALSE,
    enabled bool NOT NULL DEFAULT TRUE,
    subscribed_date timestamptz,
    unsubscribed_date timestamptz,
    state text,
    locale text,
    PRIMARY KEY ( telegram_bot_id, telegram_user_id ),
    UNIQUE ( telegram_bot_id, telegram_user_id, api_user_id )
);

CREATE TABLE telegram_bot_user_link (
    telegram_bot_id int53 NOT NULL,
    telegram_user_id int53 NOT NULL,
    telegram_bot_link_id int53 NOT NULL REFERENCES telegram_bot_link ( id ) ON DELETE CASCADE,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    new_user bool NOT NULL,
    FOREIGN KEY ( telegram_bot_id, telegram_user_id ) REFERENCES telegram_bot_user ( telegram_bot_id, telegram_user_id ) ON DELETE CASCADE,
    PRIMARY KEY ( telegram_bot_id, telegram_user_id, telegram_bot_link_id)
);

--- before insert
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

    -- update bot stats
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
CREATE FUNCTION telegram_bot_user_after_update_trigger() RETURNS TRIGGER AS $$
DECLARE
    data jsonb;
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

    IF OLD.api_user_id != NEW.api_user_id THEN
        data:= ( SELECT jsonb_set_lax( coalesce( data, '{}' ), '{api_user_id}', to_jsonb( NEW.api_user_id ), TRUE, 'use_json_null' ) );
    END IF;

    IF OLD.subscribed != NEW.subscribed THEN
        data:= ( SELECT jsonb_set_lax( coalesce( data, '{}' ), '{subscribed}', to_jsonb( NEW.subscribed ), TRUE, 'use_json_null' ) );
    END IF;

    IF OLD.returned != NEW.returned THEN
        data:= ( SELECT jsonb_set_lax( coalesce( data, '{}' ), '{returned}', to_jsonb( NEW.returned ), TRUE, 'use_json_null' ) );
    END IF;

    IF OLD.enabled != NEW.enabled THEN
        data:= ( SELECT jsonb_set_lax( coalesce( data, '{}' ), '{enabled}', to_jsonb( NEW.enabled ), TRUE, 'use_json_null' ) );
    END IF;

    IF OLD.locale != NEW.locale THEN
        data:= ( SELECT jsonb_set_lax( coalesce( data, '{}' ), '{locale}', to_jsonb( NEW.locale ), TRUE, 'use_json_null' ) );
    END IF;

    IF data IS NOT NULL THEN
        data:= ( SELECT jsonb_set( data, '{id}', to_jsonb( NEW.telegram_user_id ), TRUE ) );

       PERFORM pg_notify( 'telegram/telegram-bot-user/' || NEW.telegram_bot_id || '/update', data::text );
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_user_after_update AFTER UPDATE OF api_user_id, subscribed, enabled, locale ON telegram_bot_user FOR EACH ROW EXECUTE FUNCTION telegram_bot_user_after_update_trigger();

CREATE FUNCTION telegram_bot_user_link_after_insert_trigger() RETURNS TRIGGER AS $$
BEGIN

    UPDATE
        telegram_bot_link
    SET
        last_user_created = CURRENT_TIMESTAMP,
        total_users = total_users + 1,
        total_new_users = CASE
            WHEN NEW.new_user THEN total_new_users + 1
            ELSE total_new_users
        END,
        total_subscribed_users = total_subscribed_users + 1
    WHERE
        id = NEW.telegram_bot_link_id
    ;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_user_link_after_insert AFTER INSERT ON telegram_bot_user_link FOR EACH ROW EXECUTE FUNCTION telegram_bot_user_link_after_insert_trigger();

`;
