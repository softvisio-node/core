import sql from "#lib/sql";

export default sql`

CREATE TABLE telegram_group (
    id int53 PRIMARY KEY,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    title text,
    username text,
    is_forum bool NOT NULL
);

-- after update
CREATE FUNCTION telegram_group_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'telegram/telegram-group/update', json_build_object(
        'id', NEW.id,
        'title', NEW.title,
        'username', NEW.username,
        'is_forum', NEW.is_forum
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_group_after_update AFTER UPDATE ON telegram_group FOR EACH ROW EXECUTE FUNCTION telegram_group_after_update_trigger();

`;
