import sql from "#lib/sql";

export default sql`

CREATE TABLE telegram_bot_update (
    id serial8 PRIMARY KEY,
    update_id int8 NOT NULL,
    telegram_bot_id int8 REFERENCES telegram_bot ( id ) ON DELETE CASCADE,
    chat_id int8 NOT NULL,
    locked bool NOT NULL DEFAULT FALSE,
    type text NOT NULL,
    data json,
    UNIQUE ( telegram_bot_id, update_id )
);

CREATE INDEX telegram_bot_update_telegram_bot_id_locked_idx ON telegram_bot_update ( telegram_bot_id, locked );

-- after insert
CREATE FUNCTION telegram_bot_update_after_insert_trigger() RETURNS TRIGGER AS $$
DECLARE
    row record;
BEGIN

    FOR row IN SELECT telegram_bot_id, chat_id, max( update_id ) AS update_id FROM new_table GROUP BY telegram_bot_id, chat_id LOOP

        UPDATE
           telegram_bot
        SET
            telegram_last_update_id = row.update_id
        WHERE
            id = row.telegram_bot_id
            AND telegram_last_update_id < row.update_id;

        PERFORM pg_notify( 'telegram/telegram-bot-update/' || row.telegram_bot_id ||'/create', json_build_object(
            'chat_id', row.chat_id::text
        )::text );

    END LOOP;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_update_after_insert AFTER INSERT ON telegram_bot_update REFERENCING NEW TABLE AS new_table FOR EACH STATEMENT EXECUTE FUNCTION telegram_bot_update_after_insert_trigger();

`;
