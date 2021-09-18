import sql from "#lib/sql";

export default sql`

CREATE TABLE "notification" (
    "id" serial8 PRIMARY KEY NOT NULL,
    "date" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subject" text NOT NULL,
    "body" text NOT NULL
);

CREATE TABLE "notification_user" (
    "id" serial8 PRIMARY KEY NOT NULL,
    "notification_id" int8 NOT NULL REFERENCES "notification" ("id") ON DELETE CASCADE,
    "user_id" int8 NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "read" bool NOT NULL DEFAULT FALSE
);

`;
