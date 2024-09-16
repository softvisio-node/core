import sql from "#lib/sql";

export default sql`

CREATE SEQUENCE telegram_bot_link_id_seq AS int8 MAXVALUE ${ Number.MAX_SAFE_INTEGER };

CREATE TABLE telegram_bot_link (
    id int53 PRIMARY KEY DEFAULT nextval( 'telegram_bot_link_id_seq' ),
    telegram_bot_id int53 NOT NULL REFERENCES telegram_bot ( id ) ON DELETE CASCADE,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    name text NOT NULL,
    description text,

    last_user_created timestamptz,
    total_users int53 NOT NULL DEFAULT 0,
    total_new_users int53 NOT NULL DEFAULT 0,
    total_subscribed_users int53 NOT NULL DEFAULT 0,
    total_unsubscribed_users int53 NOT NULL DEFAULT 0,
    total_returned_users int53 NOT NULL DEFAULT 0,
    total_disabled_users int53 NOT NULL DEFAULT 0
);

ALTER SEQUENCE telegram_bot_link_id_seq OWNED BY telegram_bot_link.id;

CREATE TABLE telegram_bot_link_stats (
    telegram_bot_link_id int53 REFERENCES telegram_bot_link ( id ) ON DELETE CASCADE,
    date timestamptz NOT NULL,
    total_users int53,
    total_users_delta int53,
    total_subscribed_users int53,
    total_subscribed_users_delta int53,
    total_unsubscribed_users int53,
    total_unsubscribed_users_delta int53,
    total_returned_users int53,
    total_returned_users_delta int53,
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
