import sql from "#lib/sql";

export default sql`

CREATE TABLE telegram_user (
    id serial8 PRIMARY KEY,
    telegram_id int53 NOT NULL UNIQUE,
    is_bot bool NOT NULL DEFAULT FALSE,
    username text NOT NULL UNIQUE,
    first_name text,
    last_name text,
    language_code text,
    phone text,
    -- profile_photos_updated timestamptz,
    -- avatar text
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CREATE TABLE telegram_user_profile_photo (
--     telegram_user_id int8 NOT NULL REFERENCES telegram_user ( id ) ON DELETE CASCADE,
--     updated timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     file_id text NOT NULL,
--     file_unique_id text NOT NULL,
--     width int4 NOT NULLL,
--     height int4 NOT NULLL,
--     size unt4 NOT NULLL
-- );

-- after update
CREATE FUNCTION telegram_user_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'telegram/telegram-user/update', json_build_object(
        'id', NEW.id::text,
        'username', NEW.username,
        'first_name', NEW.first_name,
        'last_name', NEW.last_name,
        'language_code', NEW.language_code,
        'phone', NEW.phone
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_user_after_update AFTER UPDATE OF username, first_name, last_name, language_code, phone ON telegram_user FOR EACH ROW EXECUTE FUNCTION telegram_user_after_update_trigger();

`;
