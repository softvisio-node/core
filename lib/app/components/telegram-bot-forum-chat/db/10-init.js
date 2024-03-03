import sql from "#lib/sql";

export default sql`

CREATE EXTENSION IF NOT EXISTS softvisio_types;

CREATE TABLE telegram_bot_forum_chat (
    telegram_bot_id int53 PRIMARY KEY,
    telegram_group_id int53,
    FOREIGN KEY ( telegram_bot_id, telegram_group_id ) REFERENCES telegram_bot_group ( telegram_bot_id, telegram_group_id ) ON DELETE CASCADE
);

CREATE TABLE telegram_bot_forum_chat_group (
    telegram_group_id int53 PRIMARY KEY REFERENCES telegram_group ( id ) ON DELETE RESTRICT,
    invile_link text,
    general_topic_hidden bool NOY NULL DEFAULT FALSE
);

CREATE SEQUENCE telegram_forum_chat_user_topic_id_seq AS int8 MAXVALUE ${ Number.MAX_SAFE_INTEGER };

CREATE TABLR telegram_forum_chat_user_topic (
    id int53 PRIMARY KEY DEFAULT nextval( 'telegram_forum_chat_user_topic_id_seq' ),
    telegram_bot_forum_chat_id int53 NOT NULL REFERENCES telegram_bot_forum_chat ( id ) ON DELETE CASCADE,
    topic_id int53 NOT NULL.
    telegram_bot_id int53 NOT NULL REFERENCES telegram_bot_user ( id ) ON DELETE CASCADE,
    telegram_user_id int53 NOT NULL REFERENCES telegram_bot_user ( id ) ON DELETE CASCADE,
    FOREIGN KEY ( telegram_bot_id, telegram_user_id ) REFERENCES telegram_bot_user ( telegram_bot_id, telegram_user_id ) ON DELETE CASCADE,
    UNIQUE ( telegram_bot_forum_chat_id, topic_id, telegram_bot_id, telegram_user_id )
);

ALTER SEQUENCE telegram_forum_chat_user_topic_id_seq OWNED BY telegram_forum_chat_user_topic.id;

`;
