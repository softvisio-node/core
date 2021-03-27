const sql = require( "@softvisio/core/sql" );

// const CONST = require( "../../../../../const" );

module.exports = sql`

CREATE TABLE "user_token" (
    "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    "user_id" integer NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "permissions" jsonb NOT NULL,
    "name" text,
    "enabled" bool NOT NULL DEFAULT TRUE,
    "created" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "user_token_hash" (
    "user_token_id" integer PRIMARY KEY NOT NULL REFERENCES "user_token" ("id") ON DELETE CASCADE,
    "hash" text NOT NULL
);

`;
