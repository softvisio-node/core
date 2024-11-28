import sql from "#lib/sql";

export default sql`

ALTER TABLE api_session DROP COLUMN browser_major;

`;
