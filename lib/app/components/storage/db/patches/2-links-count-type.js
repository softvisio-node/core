import sql from "#lib/sql";

export default sql`

CREATE EXTENSION IF NOT EXISTS softvisio_types;

ALTER TABLE storage_image ALTER COLUMN links_count TYPE int53;

`;
