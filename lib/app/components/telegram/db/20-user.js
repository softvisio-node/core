import sql from "#lib/sql";

export default sql`

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

`;
