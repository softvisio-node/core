import sql from "#lib/sql";

export default sql`

CREATE TABLE telegram_bot_file (
    id serial8 PRIMARY KEY,
    telegram_bot_id int8 NOT NULL REFERENCES telegram_bot ( id ) ON DELETE CASCADE,
    file_id text NOT NULL,
    file_unique_id text NOT NULL,
    content_type text NOT NULL,
    storage_file_id int8 REFERENCES storage_file ( id ) ON DELTE SET NULL,
    UNIQUE ( telegram_bot_id, file_id )
);

CREATE FUNCTION create_telegram_bot_file ( _telegram_bot_id int8, _file_id text, _file_unique_id text, _content_type text ) RETURNS int8 AS $$
BEGIN

    RETURN (
        INSERT INTO
            telegram_bot_file
        (
            telegram_bot_id,
            file_id,
            file_unique_id,
            content_type
        )
        VALUES (
            _telegram_bot_id,
            _file_id,
            _file_unique_id,
            _content_type
        )
        RETURNING
            id
    );

END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION telegrm_bot_file_after_delete_trigger () RETURNS TRIGGER AS $$
BEGIN

    IF ( OLD.storage_file_id IS NOT NULL ) THEN
        DELETE FROM storage_file WHERE id = OLD.storage_file_id;
    ENF IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegrm_bot_file_after_delete AFTER DELETE ON telegrm_bot_file FOR EACH ROW EXECUTE FUNCTION telegrm_bot_file_after_delete_trigger();

`;
