import sql from "#lib/sql";

export default sql`

CREATE EXTENSION IF NOT EXISTS softvisio_types;

CREATE TABLE telegram_bot_start_message (
    telegram_bot_id int53 PRIMARY KEY REFERENCES telegram_bot ( id ) ON DELETE CASCADE,
    telegram_bot_message_id int53 NOT NULL REFERENCES telegram_bot_message ( id ) ON DELETE RESTRICT
);

`;
