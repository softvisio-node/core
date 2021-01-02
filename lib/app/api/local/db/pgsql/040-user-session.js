const sql = require( "@softvisio/core/sql" );

module.exports = sql`

CREATE TABLE "user_session" (
    "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INT4 NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "created" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER "user_session_after_delete_trigger" AFTER DELETE ON "user_session" FOR EACH ROW EXECUTE PROCEDURE api_delete_hash();

`;
