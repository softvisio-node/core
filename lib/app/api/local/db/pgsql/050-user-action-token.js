const sql = require( "@softvisio/core/sql" );

module.exports = sql`

CREATE TABLE "user_action_token" (
    "id" INT8 PRIMARY KEY NOT NULL,
    "user_id" INT8 NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "type" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER "user_action_token_after_delete_trigger" AFTER DELETE ON "user_action_token" FOR EACH ROW EXECUTE PROCEDURE api_delete_hash();

`;
