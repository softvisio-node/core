import sql from "#lib/sql";

export default sql`

CREATE TABLE "userToken" (
    "id" serial8 PRIMARY KEY NOT NULL,
    "userId" int8 NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "permissions" jsonb NOT NULL,
    "name" text,
    "enabled" bool NOT NULL DEFAULT TRUE,
    "created" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "userTokenHash" (
    "userTokenId" int8 PRIMARY KEY NOT NULL REFERENCES "userToken" ("id") ON DELETE CASCADE,
    "hash" text NOT NULL
);

`;
