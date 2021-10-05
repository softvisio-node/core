import sql from "#lib/sql";

export default sql`

ALTER TABLE "notification" ADD COLUMN "expires" timestamptz NOT NULL;

ALTER TABLE "notification_user" ADD COLUMN "deleted" bool NOT NULL DEFAULT FALSE;

CREATE INDEX "notification_user_notification_id_user_id_deleted_idx" ON "notification_user" ("notification_id", "user_id", "deleted");

`;
