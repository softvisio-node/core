import sql from "#lib/sql";

export default sql`

ALTER TABLE notification ALTER COLUMN meta DROP NOT NULL;
ALTER TABLE notification ALTER COLUMN meta DROP DEFAULT;

`;
