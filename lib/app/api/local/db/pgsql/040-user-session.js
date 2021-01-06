const sql = require( "@softvisio/core/sql" );

const CONST = require( "../../../../../const" );

module.exports = sql`

CREATE TABLE "user_session" (
    "id" INT8 PRIMARY KEY NOT NULL DEFAULT gen_token_id(${CONST.AUTH_SESSION}),
    "user_id" INT8 NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "created" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER "user_session_after_delete_trigger" AFTER DELETE ON "user_session" FOR EACH ROW EXECUTE PROCEDURE api_delete_hash();

`;
