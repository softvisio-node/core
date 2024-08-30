import sql from "#lib/sql";

export default sql`

CREATE SEQUENCE telegram_bot_contact_id_seq AS int8 MAXVALUE ${ Number.MAX_SAFE_INTEGER };

CREATE TABLE telegram_bot_contact (
    id int53 PRIMARY KEY DEFAULT nextval( 'telegram_bot_contact_id_seq' ),
    telegram_bot_id int53 NOT NULL REFERENCES telegram_bot ( id ) ON DELETE CASCADE,
    phone text,
    email text,
    address text,
    notes text,
    latitude float8,
    longitude float8
);

ALTER SEQUENCE telegram_bot_contact_id_seq OWNED BY telegram_bot_contact.id;

CREATE FUNCTION telegram_bot_contact_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    -- subscribed changed
    PERFORM pg_notify( 'telegram/telegram-bot-contact/' || NEW.telegram_bot_id || '/update', json_build_object(
        'id', NEW.id,
        'data', row_to_json( NEW )
    )::text );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_contact_after_update AFTER UPDATE ON telegram_bot_contact FOR EACH ROW EXECUTE FUNCTION telegram_bot_contact_after_update_trigger();

CREATE FUNCTION telegram_bot_contact_after_delete_trigger() RETURNS TRIGGER AS $$
BEGIN

    -- subscribed changed
    PERFORM pg_notify( 'telegram/telegram-bot-contact/' || OLD.telegram_bot_id || '/delete', json_build_object(
        'id', OLD.id
    )::text );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_contact_after_delete AFTER DELETE ON telegram_bot_contact FOR EACH ROW EXECUTE FUNCTION telegram_bot_contact_after_delete_trigger();


`;
