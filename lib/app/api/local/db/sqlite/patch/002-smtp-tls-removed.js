const sql = require( "@softvisio/core/sql" );

module.exports = sql`

ALTER TABLE "settings" RENAME COLUMN "smtp_tls" TO "_smtp_tls_removed";

`;
