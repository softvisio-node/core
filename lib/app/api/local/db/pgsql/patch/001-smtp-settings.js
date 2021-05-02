import sql from "#lib/sql";

export default sql`

ALTER TABLE "settings" RENAME COLUMN "smtp_host" TO "smtp_hostname";

`;
