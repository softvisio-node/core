import sql from "#lib/sql";

export default sql`

CREATE EXTENSION IF NOT EXISTS softvisio_types;

CREATE TABLE telegram_bot_user_contacts (
    telegram_bot_user_id int53 PRIMARY KEY REFERENCES telegram_bot_user ( id ) ON DELETE CASCADE,
    phone text,
    email text,
    address text
);

`;
