const sql = require( "@softvisio/core/sql" );

// const CONST = require( "../../../../../const" );

module.exports = sql`

-- USER
CREATE TABLE "user" (
    "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    "permissions" jsonb NOT NULL,
    "created" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" text NOT NULL UNIQUE,
    "enabled" bool NOT NULL DEFAULT TRUE,
    "email" text UNIQUE,
    "email_confirmed" bool NOT NULL DEFAULT FALSE,
    "gravatar" text,
    "telegram_name" text UNIQUE
);

INSERT INTO "sqlite_sequence" ("name", "seq") VALUES ('user', 99);

CREATE TABLE "user_hash" (
    "user_id" integer PRIMARY KEY NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "hash" text NOT NULL
);

`;
