import sql from "#lib/sql";

export default sql`

CREATE TABLE "notification" (
    "id" serial8 PRIMARY KEY NOT NULL,
    "date" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subject" text NOT NULL,
    "body" text NOT NULL,
    "expires" timestamptz NOT NULL
);

CREATE TABLE "notificationUser" (
    "id" serial8 PRIMARY KEY NOT NULL,
    "notificationId" int8 NOT NULL REFERENCES "notification" ("id") ON DELETE CASCADE,
    "userId" int8 NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "read" bool NOT NULL DEFAULT FALSE,
    "deleted" bool NOT NULL DEFAULT FALSE
);

CREATE INDEX "notificationUser_notificationId_userId_deleted_idx" ON "notificationUser" ("notificationId", "userId", "deleted");

`;
