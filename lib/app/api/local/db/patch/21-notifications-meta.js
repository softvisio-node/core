import sql from "#lib/sql";

export default sql`

ALTER TABLE notification RENAME COLUMN date TO created;

ALTER TABLE notification ADD COLUMN meta json NOT NULL DEFAULT '{}';

`;
