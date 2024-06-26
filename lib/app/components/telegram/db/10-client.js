import sql from "#lib/sql";

export default sql`

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS softvisio_types;

CREATE SEQUENCE telegram_client_id_seq AS int8 MAXVALUE ${ Number.MAX_SAFE_INTEGER };

CREATE TABLE telegram_client (
    id int53 PRIMARY KEY DEFAULT nextval( 'telegram_client_id_seq' ),
    phone_number text NOT NULL UNIQUE,
    static bool NOT NULL,
    phone_code text,
    password text,
    storage jsonb NOT NULL DEFAULT '{}'
);

ALTER SEQUENCE telegram_client_id_seq OWNED BY telegram_client.id;

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
        'phone_code', NEW.phone_code,
        'password', NEW.password
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_client_after_update AFTER UPDATE OF phone_code, password ON telegram_client FOR EACH ROW EXECUTE FUNCTION telegram_client_after_update_trigger();

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
