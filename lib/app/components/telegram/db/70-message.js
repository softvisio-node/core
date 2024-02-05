import sql from "#lib/sql";

export default sql`

CREATE SEQUENCE telegram_bot_message_id_seq AS int8 MAXVALUE ${ Number.MAX_SAFE_INTEGER };

CREATE TABLE telegram_bot_message (
    id int53 PRIMARY KEY DEFAULT nextval( 'telegram_bot_message_id_seq' ),
    telegram_bot_id int53 NOT NULL REFERENCES telegram_bot ( id ) ON DELETE CASCADE,
    data json NOT NULL
);

ALTER SEQUENCE telegram_bot_message_id_seq OWNED BY telegram_bot_message.id;

`;
