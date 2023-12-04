import sql from "#lib/sql";

export default sql`

DELETE FROM telegram_bot_link;

ALTER TABLE telegram_bot_link DROP COLUMN guid;

ALTER TABLE telegram_bot_link ADD COLUMN token int8 NOT NULL;

ALTER TABLE telegram_bot_link ADD CONSTRAINT telegram_bot_link_telegram_bot_id_token_key UNIQUE ( telegram_bot_id, token );

`;
