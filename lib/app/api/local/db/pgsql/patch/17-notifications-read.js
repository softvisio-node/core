import sql from "#lib/sql";

export default sql`

ALTER TABLE "notification_user" ADD COLUMN "read" bool NOT NULL DEFAULT FALSE;

`;
