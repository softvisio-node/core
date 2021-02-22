const sql = require( "@softvisio/core/sql" );

module.exports = sql`

ALTER TABLE "settings" RENAME COLUMN "smtp_host" TO "smtp_hostname";

`;
