import sql from "#lib/sql";

export default sql`

ALTER TABLE telegram_user ADD COLUMN api_user_id int8 REFERENCES "user" ( id ) ON DELETE RESTRICT;

`;
