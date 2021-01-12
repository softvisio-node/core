const sql = require( "@softvisio/core/sql" );

const CONST = require( "../../../../../const" );

module.exports = sql`

CREATE TABLE "user_token" (
    "id" int8 PRIMARY KEY NOT NULL DEFAULT gen_token_id(${CONST.AUTH_TOKEN}),
    "user_id" int8 NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "permissions" jsonb NOT NULL,
    "name" text,
    "enabled" bool NOT NULL DEFAULT TRUE,
    "created" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER "user_token_after_delete_trigger" AFTER DELETE ON "user_token" FOR EACH ROW EXECUTE PROCEDURE auth_hash_delete_trigger();

`;
