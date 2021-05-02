import sql from "#lib/sql";

export default sql`

CREATE TABLE "user_session" (
    "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    "user_id" integer NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "created" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "user_session_hash" (
    "user_session_id" integer PRIMARY KEY NOT NULL REFERENCES "user_session" ("id") ON DELETE CASCADE,
    "hash" text NOT NULL
);

`;
