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
    general_topic_hidden bool NOT NULL DEFAULT FALSE
);

CREATE TABLE telegram_bot_forum_chat_group_topic (
    telegram_group_id int53 NOT NULL REFERENCES telegram_bot_forum_chat_group ( telegram_group_id ) ON DELETE CASCADE,
    topic_id int53 NOT NULL,
    telegram_user_id int53 NOT NULL REFERENCES telegram_user ( id ) ON DELETE CASCADE,
    PRIMARY KEY ( telegram_group_id, topic_id ),
    UNIQUE ( telegram_group_id, telegram_user_id )
);

`;
