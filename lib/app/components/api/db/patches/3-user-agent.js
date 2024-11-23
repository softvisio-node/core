import sql from "#lib/sql";

export default sql`

ALTER TABLE api_session DROP COLUMN engine_name;
ALTER TABLE api_session DROP COLUMN engine_version;
ALTER TABLE api_session DROP COLUMN device_type;
ALTER TABLE api_session DROP COLUMN cpu_architecture;

`;
