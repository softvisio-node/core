import sql from "#lib/sql";

export default sql`

DELETE FROM telegram_bot_link;

DROP TABLE telegram_bot_file;

DROP FUNCTION create_telegram_bot_file;

DROP FUNCTION telegram_bot_file_after_delete_trigger;

`;
