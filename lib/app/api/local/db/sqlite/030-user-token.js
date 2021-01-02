const sql = require( "@softvisio/core/sql" );

module.exports = sql`

CREATE TABLE "user_token" (
    "id" UUID PRIMARY KEY NOT NULL DEFAULT(gen_random_uuid()),
    "user_id" INT4 NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "permissions" JSONB NOT NULL,
    "name" TEXT,
    "enabled" BOOL NOT NULL DEFAULT TRUE,
    "created" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER "user_token_after_delete_trigger" AFTER DELETE ON "user_token"
BEGIN
    DELETE FROM "user_hash" WHERE "id" = OLD."id";
END;

`;
