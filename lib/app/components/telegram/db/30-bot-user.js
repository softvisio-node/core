import sql from "#lib/sql";

export default sql`

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
CREATE FUNCTION telegram_bot_user_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'telegram/telegram-bot-user/update', json_build_object(
        'id', NEW.id::text,
        'telegram_bot_id', NEW.telegram_bot_id::text,
        'telegram_user_id', NEW.telegram_user_id::text,
        'user_id', NEW.user_id::text,
        'blocked', NEW.blocked,
        'banned', NEW.banned,
        'state', NEW.state
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_user_after_update AFTER UPDATE OF user_id, blocked, banned, state ON telegram_bot_user FOR EACH ROW EXECUTE FUNCTION telegram_bot_user_after_update_trigger();

`;
