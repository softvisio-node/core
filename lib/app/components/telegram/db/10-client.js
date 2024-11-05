import sql from "#lib/sql";

export default sql`

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS softvisio_types;

CREATE TABLE telegram_client (
    id int53 PRIMARY KEY,
    static bool NOT NULL,
    username text NOT NULL,
    bot bool NOT NULL,
    session text NOT NULL
);

CREATE FUNCTION telegram_client_after_insert_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'telegram/telegram-client/create', json_build_object(
        'id', NEW.id
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_client_after_insert AFTER INSERT ON telegram_client FOR EACH ROW EXECUTE FUNCTION telegram_client_after_insert_trigger();

CREATE FUNCTION telegram_client_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'telegram/telegram-client/update', json_build_object(
        'id', NEW.id,
        'session', NEW.session
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_client_after_update AFTER UPDATE OF username, session ON telegram_client FOR EACH ROW EXECUTE FUNCTION telegram_client_after_update_trigger();

CREATE FUNCTION telegram_client_after_delete_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'telegram/telegram-client/delete', json_build_object(
        'id', OLD.id
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_client_after_delete AFTER DELETE ON telegram_client FOR EACH ROW EXECUTE FUNCTION telegram_client_after_delete_trigger();

`;
