import sql from "#lib/sql";

export default sql`

DELETE FROM api_token;
ALTER TABLE api_token_hash DROP COLUMN hash;
ALTER TABLE api_token_hash ADD COLUMN hash bytea NOT NULL;

DELETE FROM api_session;
ALTER TABLE api_session_hash DROP COLUMN hash;
ALTER TABLE api_session_hash ADD COLUMN hash bytea NOT NULL;

`;
