import sql from "#lib/sql";

export default sql`

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- trigram index is required for pattern search
CREATE INDEX storage_file_path_trigram_idx ON storage_file USING gin ( path gin_trgm_ops );

`;
