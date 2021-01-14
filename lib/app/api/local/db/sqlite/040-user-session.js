const sql = require( "@softvisio/core/sql" );

// const CONST = require( "../../../../../const" );

module.exports = sql`

CREATE TABLE "user_session" (
    "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    "user_id" int8 NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "created" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "user_session_hash" (
    "user_session_id" int8 PRIMARY KEY NOT NULL REFERENCES "user_session" ("id") ON DELETE CASCADE,
    "hash" text NOT NULL
);

`;
