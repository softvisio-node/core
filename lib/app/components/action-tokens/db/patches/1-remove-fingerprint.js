import sql from "#lib/sql";

export default sql`

ALTER TABLE action_token_hash DROP COLUMN fingerprint;

`;
