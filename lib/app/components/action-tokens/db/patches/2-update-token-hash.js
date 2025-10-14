import sql from "#lib/sql";

export default sql`

DELETE FROM action_token;
ALTER TABLE action_token_hash DROP COLUMN hash;
ALTER TABLE action_token_hash ADD COLUMN hash bytea NOT NULL;

`;
