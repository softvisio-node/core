import sql from "#lib/sql";

export default sql`

CREATE TABLE telegram_bot (
    id serial8 PRIMARY KEY,
    type text NOT NULL,
    static bool NOT NULL DEFAULT FALSE,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    telegram_api_key text NOT NULL UNIQUE,
    telegram_id int8 NOT NULL UNIQUE,
    telegram_username text NOT NULL UNIQUE,
    telegram_first_name text NOT NULL,
    telegram_can_join_groups bool NOT NULL,
    telegram_can_read_all_group_messages bool NOT NULL,
    telegram_supports_inline_queries bool NOT NULL,
    telegram_next_update_id int8 NOT NULL DEFAULT 0,

    enabled bool NOT NULL DEFAULT FALSE,
    error bool NOT NULL DEFAULT FALSE,
    error_text text
);

CREATE TABLE telegram_user (
    id serial8 PRIMARY KEY,
    telegram_id int8 NOT NULL UNIQUE,
    telegram_username text NOT NULL UNIQUE,
    first_name text,
    last_name text,
    phone text,
    is_bot bool NOT NULL DEFAULT FALSE,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE telegram_bot_user (
    id serial8 PRIMARY KEY,
    telegram_bot_id int8 NOT NULL REFERENCES telegram_bot ( id ) ON DELETE CASCADE,
    telegram_user_id int8 NOT NULL REFERENCES telegram_user ( id ) ON DELETE RESTRICT,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    blocked bool NOT NULL DEFAULT FALSE,
    banned bool NOT NULL DEFAULT FALSE,
    state json NOT NULL DEFAULT '{}',
    UNIQUE ( telegram_bot_id, telegram_user_id )
);

-- before insert user
CREATE FUNCTION user_telegram_before_insert_trigger() RETURNS TRIGGER AS $$
BEGIN

    IF NEW.telegram_username IS NOT NULL THEN
        NEW.telegram_user_id = ( SELECT telegram_id FROM telegram_user WHERE telegram_username = NEW.telegram_username );
    ELSE
        NEW.telegram_user_id = NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_telegram_before_insert BEFORE INSERT ON "user" FOR EACH ROW EXECUTE FUNCTION user_telegram_before_insert_trigger();

-- before update user
CREATE FUNCTION user_telegram_before_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    IF OLD.telegram_username != NEW.telegram_username THEN
        NEW.telegram_user_id = ( SELECT telegram_id FROM telegram_user WHERE telegram_username = NEW.telegram_username );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_telegram_before_update BEFORE UPDATE ON "user" FOR EACH ROW EXECUTE FUNCTION user_telegram_before_update_trigger();

-- telegram bot started
CREATE FUNCTION telegram_user_after_insert_trigger() RETURNS TRIGGER AS $$
BEGIN
    UPDATE "user" SET telegram_user_id = NEW.telegram_id WHERE telegram_username = NEW.telegram_username;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_user_after_insert AFTER INSERT ON telegram_user FOR EACH ROW EXECUTE FUNCTION telegram_user_after_insert_trigger();

-- telegram bot blocked
CREATE FUNCTION telegram_user_after_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
    UPDATE "user" SET telegram_user_id = NULL WHERE telegram_username = OLD.telegram_username;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_user_after_delete AFTER DELETE ON telegram_user FOR EACH ROW EXECUTE FUNCTION telegram_user_after_delete_trigger();

`;
