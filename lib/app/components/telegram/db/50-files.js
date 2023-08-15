import sql from "#lib/sql";

export default sql`

CREATE TABLE telegram_bot_file (
    id serial8 PRIMARY KEY,
    telegram_bot_id int8 NOT NULL REFERENCES telegram_bot ( id ) ON DELETE CASCADE,
    file_id text NOT NULL,
    file_unique_id text NOT NULL,
    content_type text NOT NULL,
    UNIQUE ( telegram_bot_id, file_id )
);

`;
