import sql from "#lib/sql";

export default sql`

ALTER TABLE telegram_user ADD UNIQUE ( api_user_id );;

`;
