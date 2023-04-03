import sql from "#lib/sql";

export default sql`

CREATE TABLE telegram_bot (
    id serial8 PRIMARY KEY,
    api_key text NOT NULL UNIQUE,
    telegram_id int8 NOT NULL UNIQUE,
   telegram_username text NOT NULL UNIQUE
);

CREATE TABLE telegram_user (
    id serial8 PRIMARY KEY,
    telegram_id int8 NOT NULL UNIQUE
);

CREATE TABLE telegram_bot_user (
    telegram_bot_id int8 REFERENCES telegram_bot ( id ) ON DELETE CASCADE,
    telegram_user_id int8 REFERENCES telegram_user ( id ) ON DELETE CASCADE,
    PRIMARY KEY ( telegram_bot_id, telegram_user_id )
);

`;
