import sql from "#lib/sql";

export default sql`

ALTER TABLE api_token_hash DROP COLUMN fingerprint;

ALTER TABLE api_session_hash DROP COLUMN fingerprint;

`;
