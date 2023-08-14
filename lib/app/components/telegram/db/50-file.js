import sql from "#lib/sql";

export default sql`

CREATE TABLE telegram_file (
    id serial8 PRIMARY KEY,
    TELEGRAM_file_unique_id text NOT NULL UNIQUE,
    storage_file_id int8 NOT NULL REFERENCES storage_file ( id ) ON DELETE RESTRICT
);

CREATE TABLE telegram_bot_file (
    id serial8 PRIMARY KEY,
    telegram_file_id int8 NOT NULL REFERENCES telegram_file ( id ) ON DELETE RESTRICT,
    telegram_bot_id int8 NOT NULL REFERENCES telegram_bot ( id ) ON DELETE CASCADE,
    telegram_file_id text NOT NULL,
    UNIQUE ( telegram_bot_id, telegram_file_id )
);

CREATE FUNCTION telegram_file_after_delete_trigger() RETURNS TRIGGER AS $$
BEGIN

    DELETE FROM storage_file WHERE id = OLD.storage_file_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_file_after_delete AFTER DELETE ON telegram_file FOR EACH ROW EXECUTE FUNCTION telegram_file_after_delete_trigger();

CREATE FUNCTION telegram_bot_file_after_delete_trigger() RETURNS TRIGGER AS $$
BEGIN

    IF ( NOT EXISTS ( SELECT FROM telegram_bot_file WHERE telegram_file_id = OLD.telegram_file_id ) ) THEN
        DELETE FROM telegram_file WHERE id = OLD.OLD.telegram_file_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_file_after_delete AFTER DELETE ON telegram_bot_file FOR EACH ROW EXECUTE FUNCTION telegram_bot_file_after_delete_trigger();


`;
