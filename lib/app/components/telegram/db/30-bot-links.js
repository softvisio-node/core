import sql from "#lib/sql";

export default sql`

CREATE TABLE telegram_bot_link (
    id serial8 PRIMARY KEY,
    telegram_bot_id int8 NOT NULL REFERENCES telegram_bot ( id ) ON DELETE CASCADE,
    guid uuid NOT NULL UNIQUE,
    start_param text NOT NULL,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    name text NOT NULL,
    description text,

    last_user_created timestamptz,
    total_users int4 NOT NULL DEFAULT 0,
    total_subscribed_users int4 NOT NULL DEFAULT 0,
    total_unsubscribed_users int4 NOT NULL DEFAULT 0,
    total_returned_users int4 NOT NULL DEFAULT 0,
    total_banned_users int4 NOT NULL DEFAULT 0

);

CREATE TABLE telegram_bot_link_stats (
    telegram_bot_link_id int8 REFERENCES telegram_bot_link ( id ) ON DELETE CASCADE,
    date timestamptz NOT NULL,
    total_users int4,
    total_users_delta int4,
    total_subscribed_users int4,
    total_subscribed_users_delta int4,
    total_unsubscribed_users int4,
    total_unsubscribed_users_delta int4,
    total_returned_users int4,
    total_returned_users_delta int4,
    PRIMARY KEY ( telegram_bot_link_id, date )
);

CREATE FUNCTION telegram_bot_link_after_update_stats_trigger() RETURNS TRIGGER AS $$
BEGIN

    INSERT INTO
        telegram_bot_link_stats AS t
    (
        date,
        telegram_bot_link_id,
        total_users,
        total_users_delta,
        total_subscribed_users,
        total_subscribed_users_delta,
        total_unsubscribed_users,
        total_unsubscribed_users_delta,
        total_returned_users,
        total_returned_users_delta
    )
    VALUES (
        date_trunc( 'hour', CURRENT_TIMESTAMP ),
        NEW.id,
        NEW.total_users,
        NEW.total_users - OLD.total_users,
        NEW.total_subscribed_users,
        NEW.total_subscribed_users - OLD.total_subscribed_users,
        NEW.total_unsubscribed_users,
        NEW.total_unsubscribed_users - OLD.total_unsubscribed_users,
        NEW.total_returned_users,
        NEW.total_returned_users - OLD.total_returned_users
    )
    ON CONFLICT ( date, telegram_bot_link_id ) DO UPDATE SET
        total_users = EXCLUDED.total_users,
        total_users_delta = t.total_users_delta + EXCLUDED.total_users_delta,
        total_subscribed_users = EXCLUDED.total_subscribed_users,
        total_subscribed_users_delta = t.total_subscribed_users_delta + EXCLUDED.total_subscribed_users_delta,
        total_unsubscribed_users = EXCLUDED.total_unsubscribed_users,
        total_unsubscribed_users_delta = t.total_unsubscribed_users_delta + EXCLUDED.total_unsubscribed_users_delta,
        total_returned_users = EXCLUDED.total_returned_users,
        total_returned_users_delta = t.total_returned_users_delta + EXCLUDED.total_returned_users_delta;

    RETURN NULL;

END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_link_after_update_stats AFTER UPDATE OF total_users, total_subscribed_users, total_unsubscribed_users, total_returned_users ON telegram_bot_link FOR EACH ROW EXECUTE FUNCTION telegram_bot_link_after_update_stats_trigger();

`;
