import sql from "#lib/sql";

export default sql`

UPDATE telegram_bot_user SET banned = NOT banned;

ALTER TABLE telegram_bot_user ALTER COLUMN banned SET DEFAULT TRUE;

`;
