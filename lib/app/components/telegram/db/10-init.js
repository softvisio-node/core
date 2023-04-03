import sql from "#lib/sql";

export default sql`

CREATE TABLE telegram_bot (
    id serial8 PRIMARY KEY,
    telegram_id serial8 NOT NULL UNIQUE,
    api_key text NOT NULL UNIQUE
);

`;
