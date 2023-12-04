import sql from "#lib/sql";

export default sql`

DELETE FROM telegram_bot_link;

DROP TABLE IF EXISTS telegram_bot_file;

DROP FUNCTION IF EXISTS create_telegram_bot_file;

DROP FUNCTION IF EXISTS telegram_bot_file_after_delete_trigger;

`;
