import sql from "#lib/sql";

export default sql`

CREATE TABLE telegram_user (
    id serial8 PRIMARY KEY,
    telegram_id int8 NOT NULL UNIQUE,
    is_bot bool NOT NULL DEFAULT FALSE,
    username text NOT NULL UNIQUE,
    first_name text,
    last_name text,
    phone text,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE telegram_bot_user (
    id serial8 PRIMARY KEY,
    telegram_bot_id int8 NOT NULL REFERENCES telegram_bot ( id ) ON DELETE CASCADE,
    telegram_user_id int8 NOT NULL REFERENCES telegram_user ( id ) ON DELETE RESTRICT,
    user_id int8 REFERENCES "user" ( id ) ON DELETE SET NULL,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    blocked bool NOT NULL DEFAULT FALSE,
    banned bool NOT NULL DEFAULT FALSE,
    state json NOT NULL DEFAULT '{}',
    UNIQUE ( telegram_bot_id, telegram_user_id ),
    UNIQUE ( telegram_bot_id, user_id )
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

CREATE TRIGGER telegram_user_after_update AFTER UPDATE OF username, first_name, last_name, phone ON telegram_bot FOR EACH ROW EXECUTE FUNCTION telegram_user_after_update_trigger();


`;
