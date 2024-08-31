import sql from "#lib/sql";

export default sql`

ALTER TABLE monitoring_instance RENAME COLUMN cpu_usage TO cpu_used;

`;
