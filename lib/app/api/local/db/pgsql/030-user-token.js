const sql = require( "@softvisio/core/sql" );

const CONST = require( "../../../../../const" );

module.exports = sql`

CREATE TABLE "user_token" (
    "id" INT8 PRIMARY KEY NOT NULL DEFAULT gen_user_id(${CONST.TOKEN_TYPE_TOKEN}),
    "user_id" INT8 NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "permissions" JSONB NOT NULL,
    "name" TEXT,
    "enabled" BOOL NOT NULL DEFAULT TRUE,
    "created" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER "user_token_after_delete_trigger" AFTER DELETE ON "user_token" FOR EACH ROW EXECUTE PROCEDURE api_delete_hash();

`;
