import sql from "#lib/sql";

export default sql`

ALTER TABLE crypto_key ADD COLUMN revoke_date timestamptz;

`;
