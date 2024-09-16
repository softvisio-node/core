import sql from "#lib/sql";

export default sql`

ALTER TABLE api_session ADD COLUMN geoip_name text;

`;
