const sql = require( "@softvisio/core/sql" );

module.exports = sql`

CREATE TABLE "user_action_token" (
    "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    "user_id" int8 NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "type" int2 NOT NULL,
    "email" text NOT NULL,
    "created" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "user_action_token_hash" (
    "user_action_token_id" int8 PRIMARY KEY NOT NULL REFERENCES "user_action_token" ("id") ON DELETE CASCADE,
    "hash" text NOT NULL
);

`;
