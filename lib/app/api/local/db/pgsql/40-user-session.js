import sql from "#lib/sql";

export default sql`

CREATE TABLE "userSession" (
    "id" serial8 PRIMARY KEY NOT NULL,
    "userId" int8 NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "created" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "userSession_hash" (
    "userSessionId" int8 PRIMARY KEY NOT NULL REFERENCES "userSession" ("id") ON DELETE CASCADE,
    "hash" text NOT NULL
);

`;
