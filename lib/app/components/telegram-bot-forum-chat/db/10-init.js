import sql from "#lib/sql";

export default sql`

CREATE EXTENSION IF NOT EXISTS softvisio_types;

CREATE TABLE telegram_bot_forum_chat (
    telegram_bot_id int53 PRIMARY KEY REFERENCES telegram_bot ( id ) ON DELETE CASCADE,
    telegram_group_id int53 NOT NULL
);

CREATE TABLE telegram_bot_forum_chat_group (
    telegram_group_id int53 PRIMARY KEY REFERENCES telegram_group ( id ) ON DELETE RESTRICT,
    general_topic_hidden bool NOT NULL DEFAULT FALSE,
    chat_permissions_set bool NOT NULL DEFAULT FALSE,
    invile_link text
);

CREATE TABLE telegram_bot_forum_chat_group_topic (
    telegram_group_id int53 NOT NULL REFERENCES telegram_bot_forum_chat_group ( telegram_group_id ) ON DELETE CASCADE,
    topic_id int53 NOT NULL,
    telegram_user_id int53 NOT NULL REFERENCES telegram_user ( id ) ON DELETE CASCADE,
    name text NOT NULL,
    PRIMARY KEY ( telegram_group_id, topic_id ),
    UNIQUE ( telegram_group_id, telegram_user_id )
);

`;
