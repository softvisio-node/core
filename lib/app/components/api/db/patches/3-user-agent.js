import sql from "#lib/sql";

export default sql`

ALTER TABLE api_session DROP COLUMN engine_name;
ALTER TABLE api_session DROP COLUMN engine_version;
ALTER TABLE api_session DROP COLUMN device_type;
ALTER TABLE api_session DROP COLUMN cpu_architecture;

ALTER TABLE api_session RENAME COLUMN browser_name TO browser_family;
ALTER TABLE api_session RENAME COLUMN os_name TO os_family;
ALTER TABLE api_session RENAME COLUMN device_vendor TO device_brand;

`;
