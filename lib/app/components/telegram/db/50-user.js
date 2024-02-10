import sql from "#lib/sql";

export default sql`

CREATE TABLE telegram_user (
    id int53 PRIMARY KEY,
    api_user_id int53 UNIQUE REFERENCES "user" ( id ) ON DELETE RESTRICT,
    is_bot bool NOT NULL DEFAULT FALSE,
    username text NOT NULL UNIQUE,
    first_name text,
    last_name text,
    phone text,
    phone_updated timestamptz,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE VIEW telegram_user_view AS
SELECT
    telegram_user.id AS telegram_user_id,
    telegram_user.api_user_id AS api_user_id,
    json_build_object(
        'id', telegram_user.id,
        'api_user_id', telegram_user.api_user_id,
        'is_bot', telegram_user.is_bot,
        'username', telegram_user.username,
        'first_name', telegram_user.first_name,
        'last_name', telegram_user.last_name,
        'phone', telegram_user.phone

    ) AS telegram_user
FROM
    telegram_user;

-- after update
CREATE FUNCTION telegram_user_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'telegram/telegram-user/update', json_build_object(
        'id', NEW.id,
        'api_user_id', NEW.api_user_id,
        'username', NEW.username,
        'first_name', NEW.first_name,
        'last_name', NEW.last_name,
        'phone', NEW.phone
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_user_after_update AFTER UPDATE OF api_user_id, username, first_name, last_name, phone ON telegram_user FOR EACH ROW EXECUTE FUNCTION telegram_user_after_update_trigger();

CREATE FUNCTION telegram_user_phone_before_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    NEW.phone_updated = CURRENT_TIMESTAMP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_user_phone_before_update BEFORE UPDATE OF phone ON telegram_user FOR EACH ROW EXECUTE FUNCTION telegram_user_phone_before_update_trigger();

`;
