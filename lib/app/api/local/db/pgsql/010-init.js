import sql from "#core/sql";

export default sql`

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE EXTENSION IF NOT EXISTS "timescaledb" CASCADE;

`;
