const sql = require( "@softvisio/core/sql" );

module.exports = sql`

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "timescaledb" CASCADE;

`;
