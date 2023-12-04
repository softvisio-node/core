import sql from "#lib/sql";

export default sql`

ALTER TABLE telegram_bot_user DROP CONSTRAINT telegram_bot_user_telegram_user_id_fkey;

UPDATE telegram_bot_user SET telegram_user_id = telegram_user.telegram_id FROM telegram_user WHERE telegram_bot_user.telegram_user_id = telegram_user.id;

ALTER TABLE telegram_user DROP COLUMN id;

ALTER TABLE telegram_user RENAME COLUMN telegram_id TO id;

ALTER TABLE telegram_user DROP CONSTRAINT telegram_user_telegram_id_key;

ALTER TABLE telegram_user ADD PRIMARY KEY ( id );

ALTER TABLE telegram_bot_user ADD CONSTRAINT telegram_bot_user_telegram_user_id_fkey FOREIGN KEY ( telegram_user_id ) REFERENCES telegram_user ( id ) ON DELETE RESTRICT;


`;
