import sql from "#lib/sql";

export default sql`

ALTER TABLE "settings" RENAME COLUMN "smtp_tls" TO "_smtp_tls_removed";

`;
