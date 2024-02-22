import sql from "#lib/sql";

export default sql`

CREATE EXTENSION IF NOT EXISTS softvisio_types;

CREATE TABLE telegram_bot_contacts (
    telegram_bot_id int53 PRIMARY KEY REFERENCES telegram_bot_( id ) ON DELETE CASCADE,
    phone text,
    email text,
    address text,
    notes int53 text
);

`;
