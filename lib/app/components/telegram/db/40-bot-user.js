import sql from "#lib/sql";

export default sql`
CREATE TABLE telegram_bot_subscription_stat (
    date timestamptz NOT NULL,
    telegram_bot_id int8 NOT NULL REFERENCES telegram_bot ( id ) ON DELETE CASCADE,
    telegram_bot_ad_campaign_id int8 REFERENCES telegram_bot_ad_campaign ( id ) ON DELETE SET NULL,
    subscribed_users int4 NOT NULL DEFAULT 0,
    unsubscribed_users int4 NOT NULL DEFAULT 0,
    PRIMARY KEY ( date, telegram_bot_id ),
    UNIQUE ( date, telegram_bot_id, telegram_bot_ad_campaign_id )
);

CREATE TABLE telegram_bot_user (
    id serial8 PRIMARY KEY,
    telegram_bot_id int8 NOT NULL REFERENCES telegram_bot ( id ) ON DELETE CASCADE,
    telegram_user_id int8 NOT NULL REFERENCES telegram_user ( id ) ON DELETE RESTRICT,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    api_user_id int8 REFERENCES "user" ( id ) ON DELETE SET NULL,
    subscribed bool NOT NULL DEFAULT TRUE,
    banned bool NOT NULL DEFAULT FALSE,
    state json NOT NULL DEFAULT '{}',
    locale text,
    telegram_bot_ad_campaign_id int8 REFERENCES telegram_bot_ad_campaign ( id ) ON DELETE SET NULL,
    UNIQUE ( telegram_bot_id, telegram_user_id ),
    UNIQUE ( telegram_bot_id, api_user_id )
);

CREATE FUNCTION telegram_bot_user_subscribe_update( _bot_id int8, _telegram_bot_ad_campaign_id int8, _subscribed bool, _new_user bool ) RETURNS VOID AS $$
BEGIN
UPDATE
        telegram_bot
    SET
       total_users = CASE WHEN _new_user THEN total_users + 1 ELSE total_users END,
        total_subscribed_users = CASE WHEN _subscribed THEN total_subscribed_users + 1 ELSE total_subscribed_users END
    WHERE
        id = _bot_id
    ;

    INSERT INTO
        telegram_bot_subscription_stat AS t
    ( date, telegram_bot_id, telegram_bot_ad_campaign_id, subscribed_users, unsubscribed_users ) VALUES (
        date_trunc( 'hour', CURRENT_TIMESTAMP ),
        _bot_id,
        _telegram_bot_ad_campaign_id,
        CASE WHEN _subscribed THEN 1 ELSE 0 END,
        CASE WHEN _subscribed THEN 0 ELSE 1 END
    )
    ON CONFLICT ( date, telegram_bot_id, telegram_bot_ad_campaign_id ) DO UPDATE SET
        subscribed_users = CASE WHEN _subscribed THEN t.subscribed_users + 1 ELSE t.subscribed_users END,
        unsubscribed_users = CASE WHEN _subscribed THEN t.unsubscribed_users ELSE t.unsubscribed_users + 1 END
    ;

    IF _telegram_bot_ad_campaign_id THEN

        UPDATE
            telegram_bot_ad_campaign
        SET
           total_users = CASE WHEN _new_user THEN total_users + 1 ELSE total_users END,
            total_subscribed_users = CASE WHEN _subscribed THEN total_subscribed_users + 1 ELSE total_subscribed_users END
        WHERE
            id = _telegram_bot_ad_campaign_id
        ;

    END IF;

END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION telegram_bot_user_after_insert_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM telegram_bot_user_subscribe_update(
        NEW.telegram_bot_id,
        NEW.telegram_bot_ad_campaign_id,
        NEW.subscribed,
        TRUE
    );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_user_after_insert AFTER INSERT ON telegram_bot_user FOR EACH ROW EXECUTE FUNCTION telegram_bot_user_after_insert_trigger();

-- after update
CREATE FUNCTION telegram_bot_user_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    IF NEW.subscribed != OLD.subscribed THEN

        PERFORM telegram_bot_user_subscribe_update(
            NEW.telegram_bot_id,
            NEW.telegram_bot_ad_campaign_id,
            NEW.subscribed,
            FALSE
        );

    END IF;

    PERFORM pg_notify( 'telegram/telegram-bot-user/' || NEW.telegram_bot_id || '/update', json_build_object(
        'id', NEW.id::text,
        'api_user_id', NEW.api_user_id::text,
        'subscribed', NEW.subscribed,
        'banned', NEW.banned,
        'locale', NEW.locale
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_user_after_update AFTER UPDATE OF api_user_id, subscribed, banned, locale ON telegram_bot_user FOR EACH ROW EXECUTE FUNCTION telegram_bot_user_after_update_trigger();

`;
