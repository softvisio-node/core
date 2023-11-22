import sql from "#lib/sql";

export default sql`

DROP TRIGGER telegram_bot_after_update ON telegram_bot;

DROP FUNCTION telegram_bot_after_update_trigger;

ALTER TABLE telegram_bot REANME COLUMN telegram_username TO username;

CREATE FUNCTION telegram_bot_after_update_trigger () RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'telegram/telegram-bot/update', json_build_object(
        'id', NEW.id::text,
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

`;
