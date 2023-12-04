import sql from "#lib/sql";

export default sql`

ALTER TABLE telegram_bot_update ALTER COLUMN chat_id DROP NOT NULL;

`;
