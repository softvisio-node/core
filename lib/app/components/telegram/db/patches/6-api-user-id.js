import sql from "#lib/sql";

export default sql`

ALTER TABLE telegram_bot RENAME COLUMN telegram_id TO telegram_user_id;

`;
