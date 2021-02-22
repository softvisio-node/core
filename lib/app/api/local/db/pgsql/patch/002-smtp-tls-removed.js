const sql = require( "@softvisio/core/sql" );

module.exports = sql`

ALTER TABLE "settings" DROP COLUMN "smtp_tls";

`;
