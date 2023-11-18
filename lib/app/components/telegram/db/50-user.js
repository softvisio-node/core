import sql from "#lib/sql";

export default sql`

CREATE TABLE telegram_user (
    id serial8 PRIMARY KEY,
    api_user_id int8 NOT NULL REFERENCES "user" ( id ) ON DELETE RESTRICT,
    telegram_id int53 NOT NULL UNIQUE,
    is_bot bool NOT NULL DEFAULT FALSE,
    username text NOT NULL UNIQUE,
    first_name text,
    last_name text,
    phone text,
    phone_updated timestamptz,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- after update
CREATE FUNCTION telegram_user_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'telegram/telegram-user/update', json_build_object(
        'id', NEW.id::text,
        'username', NEW.username,
        'first_name', NEW.first_name,
        'last_name', NEW.last_name,
        'phone', NEW.phone
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_user_after_update AFTER UPDATE OF username, first_name, last_name, phone ON telegram_user FOR EACH ROW EXECUTE FUNCTION telegram_user_after_update_trigger();

CREATE FUNCTION telegram_user_phone_before_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    NEW.phone_updated = CURRENT_TIMESTAMP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_user_phone_before_update BEFORE UPDATE OF phone ON telegram_user FOR EACH ROW EXECUTE FUNCTION telegram_user_phone_before_update_trigger();

`;
