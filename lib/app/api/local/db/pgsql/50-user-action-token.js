import sql from "#lib/sql";

export default sql`

CREATE TABLE "userActionToken" (
    "id" serial8 PRIMARY KEY NOT NULL,
    "userId" int8 NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "type" int2 NOT NULL,
    "email" text NOT NULL,
    "created" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "userActionTokenHash" (
    "userActionTokenId" int8 PRIMARY KEY NOT NULL REFERENCES "userActionToken" ("id") ON DELETE CASCADE,
    "hash" text NOT NULL
);

`;
