import sql from "#lib/sql";

export default sql`

CREATE TABLE telegram_channel (
    id int53 PRIMARY KEY,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    title text,
    username text
);

-- after update
CREATE FUNCTION telegram_channel_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'telegram/telegram-channel/update', json_build_object(
        'id', NEW.id,
        'title', NEW.title,
        'username', NEW.username
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_channel_after_update AFTER UPDATE ON telegram_channel FOR EACH ROW EXECUTE FUNCTION telegram_channel_after_update_trigger();

`;
