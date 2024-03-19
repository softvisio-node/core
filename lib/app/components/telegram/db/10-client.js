import sql from "#lib/sql";

export default sql`

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS softvisio_types;

CREATE SEQUENCE telegram_client_id_seq AS int8 MAXVALUE ${ Number.MAX_SAFE_INTEGER };

CREATE TABLE telegram_client (
    id int53 PRIMARY KET DEFAULT nextval( 'telegram_client_id_seq' ),
    phone_number text NOT NULL UNIQUE,
    storate bytea NOT NULL
);

ALTER SEQUENCE telegram_client_id_seq OWNED BY telegram_client.id;




-- after insert
CREATE FUNCTION telegram_bot_after_insert_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'telegram/telegram-bot/create', json_build_object(
        'id', NEW.id,
        'type', NEW.type
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_after_insert AFTER INSERT ON telegram_bot FOR EACH ROW EXECUTE FUNCTION telegram_bot_after_insert_trigger();

-- after update
CREATE FUNCTION telegram_bot_after_update_trigger () RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'telegram/telegram-bot/update', json_build_object(
        'id', NEW.id,
        'name', NEW.name,
        'short_description', NEW.short_description,
        'description', NEW.description,
        'username', NEW.username,
        'telegram_can_join_groups', NEW.telegram_can_join_groups,
        'telegram_can_read_all_group_messages', NEW.telegram_can_read_all_group_messages,
        'telegram_supports_inline_queries', NEW.telegram_supports_inline_queries,
        'started', NEW.started
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_after_update AFTER UPDATE OF username, name, short_description, description, telegram_can_join_groups, telegram_can_read_all_group_messages, telegram_supports_inline_queries, started ON telegram_bot FOR EACH ROW EXECUTE FUNCTION telegram_bot_after_update_trigger();

CREATE FUNCTION telegram_bot_after_deleted_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'telegram/telegram-bot/deleted/update', json_build_object(
        'id', NEW.id,
        'deleted', NEW.deleted,
        'type', NEW.type
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_after_deleted_update AFTER UPDATE OF deleted ON telegram_bot FOR EACH ROW EXECUTE FUNCTION telegram_bot_after_deleted_update_trigger();

CREATE FUNCTION telegram_bot_locales_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'telegram/telegram-bot/update', json_build_object(
        'id', NEW.id,
        'locales', NEW.locales,
        'default_locale', NEW.default_locale
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_locales_after_update AFTER UPDATE OF locales, default_locale ON telegram_bot FOR EACH ROW EXECUTE FUNCTION telegram_bot_locales_after_update_trigger();

-- after delete
CREATE FUNCTION telegram_bot_after_delete_trigger() RETURNS TRIGGER AS $$
BEGIN

    DELETE FROM acl WHERE id = OLD.acl_id;

    PERFORM pg_notify( 'telegram/telegram-bot/deleted/update', json_build_object(
        'id', OLD.id,
        'deleted', TRUE
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_after_delete AFTER DELETE ON telegram_bot FOR EACH ROW EXECUTE FUNCTION telegram_bot_after_delete_trigger();

CREATE FUNCTION telegram_bot_after_update_stats_trigger() RETURNS TRIGGER AS $$
BEGIN

    INSERT INTO
        telegram_bot_stats AS t
    (
        date,
        telegram_bot_id,
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
    ON CONFLICT ( date, telegram_bot_id ) DO UPDATE SET
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

CREATE TRIGGER telegram_bot_after_update_stats AFTER UPDATE OF total_users, total_subscribed_users, total_unsubscribed_users, total_returned_users ON telegram_bot FOR EACH ROW EXECUTE FUNCTION telegram_bot_after_update_stats_trigger();

-- api key after update
CREATE FUNCTION telegram_bot_api_token_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'telegram/telegram-bot/update', json_build_object(
        'id', NEW.telegram_bot_id,
        'telegram_bot_api_token', NEW.api_token
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_api_token_after_update AFTER UPDATE ON telegram_bot_api_token FOR EACH ROW EXECUTE FUNCTION telegram_bot_api_token_after_update_trigger();

`;
