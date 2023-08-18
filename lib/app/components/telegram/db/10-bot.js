import sql from "#lib/sql";

export default sql`

CREATE EXTENSION IF NOT EXISTS softvisio_types;

CREATE TABLE telegram_bot (
    id serial8 PRIMARY KEY,
    type text NOT NULL,
    static bool NOT NULL DEFAULT FALSE,
    locales json,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    telegram_id int8 NOT NULL UNIQUE,
    telegram_api_key text NOT NULL UNIQUE,
    telegram_username text NOT NULL UNIQUE,
    telegram_first_name text NOT NULL,
    telegram_can_join_groups bool NOT NULL,
    telegram_can_read_all_group_messages bool NOT NULL,
    telegram_supports_inline_queries bool NOT NULL,
    telegram_last_update_id int8 NOT NULL DEFAULT 0,

    total_users int4 NOT NULL DEFAULT 0,
    total_subscribed_users int4 NOT NULL DEFAULT 0,

    started bool NOT NULL DEFAULT FALSE,
    error bool NOT NULL DEFAULT FALSE,
    error_text text
);

CREATE TABLE telegram_bot_subscription_stats (
    date timestamptz NOT NULL,
    telegram_bot_id int8 NOT NULL REFERENCES telegram_bot ( id ) ON DELETE CASCADE,
    subscribed_users int4 NOT NULL DEFAULT 0,
    unsubscribed_users int4 NOT NULL DEFAULT 0,
    PRIMARY KEY ( date, telegram_bot_id )
);

-- after insert
CREATE FUNCTION telegram_bot_after_insert_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'telegram/telegram-bot/create', json_build_object(
        'id', NEW.id::text,
        'type', NEW.type
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_after_insert AFTER INSERT ON telegram_bot FOR EACH ROW EXECUTE FUNCTION telegram_bot_after_insert_trigger();

-- after update
CREATE FUNCTION telegram_bot_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'telegram/telegram-bot/update', json_build_object(
        'id', NEW.id::text,
        'telegram_api_key', NEW.telegram_api_key,
        'telegram_username', NEW.telegram_username,
        'telegram_first_name', NEW.telegram_first_name,
        'telegram_can_join_groups', NEW.telegram_can_join_groups,
        'telegram_can_read_all_group_messages', NEW.telegram_can_read_all_group_messages,
        'telegram_supports_inline_queries', NEW.telegram_supports_inline_queries,
        'started', NEW.started
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_after_update AFTER UPDATE OF telegram_api_key, telegram_username, telegram_first_name, telegram_can_join_groups, telegram_can_read_all_group_messages, telegram_supports_inline_queries, started ON telegram_bot FOR EACH ROW EXECUTE FUNCTION telegram_bot_after_update_trigger();

CREATE FUNCTION telegram_bot_locales_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'telegram/telegram-bot/update', json_build_object(
        'id', NEW.id::text,
        'locales', NEW.locales
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_locales_after_update AFTER UPDATE OF locales ON telegram_bot FOR EACH ROW EXECUTE FUNCTION telegram_bot_locales_after_update_trigger();

-- after delete
CREATE FUNCTION telegram_bot_after_delete_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'telegram/telegram-bot/delete', json_build_object(
        'id', OLD.id::text
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_after_delete AFTER DELETE ON telegram_bot FOR EACH ROW EXECUTE FUNCTION telegram_bot_after_delete_trigger();

`;
