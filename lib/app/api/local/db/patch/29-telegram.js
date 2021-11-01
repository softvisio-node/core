import sql from "#lib/sql";

export default sql`

CREATE OR REPLACE FUNCTION user_telegram_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.chat_id IS NULL THEN
        PERFORM pg_notify( 'api/user-telegram-chat/update', json_build_object( 'user_id', OLD.user_id::text, 'chat_id', NULL )::text );
    ELSE
        PERFORM pg_notify( 'api/user-telegram-chat/update', json_build_object( 'user_id', NEW.user_id::text, 'chat_id', NEW.chat_id )::text );
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE user_notification_type (
    id serial8 PRIMARY KEY NOT NULL,
    user_id int8 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    type text NOT NULL,
    internal bool,
    email bool,
    telegram bool,
    push bool,
    UNIQUE ( user_id, type )
);

`;
