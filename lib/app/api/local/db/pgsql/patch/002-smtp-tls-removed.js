import sql from "#lib/sql";

export default sql`

ALTER TABLE "settings" DROP COLUMN "smtp_tls";

`;
