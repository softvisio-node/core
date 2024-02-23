import sql from "#lib/sql";

export default sql`

CREATE EXTENSION IF NOT EXISTS softvisio_types;

CREATE TABLE telegram_bot_telegram_bot_contact (
    telegram_bot_id int53 PRIMARY KEY REFERENCES telegram_bot ( id ) ON DELETE CASCADE,
    telegram_bot_contact_id int53 NOT NNULL REFERENCES telegram_bot_contact ( id ) ON DELETE RESTRICT
);

`;
