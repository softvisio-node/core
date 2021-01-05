const sql = require( "@softvisio/core/sql" );

const CONST = require( "../../../../../const" );

module.exports = sql`

CREATE TABLE "user_token" (
    "id" INT8 PRIMARY KEY,
    "user_id" INT8 NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "permissions" JSONB NOT NULL,
    "name" TEXT,
    "enabled" BOOL NOT NULL DEFAULT TRUE,
    "created" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER "after_insert_user_token_id_trigger" AFTER INSERT ON "user_token"
BEGIN
    UPDATE "_sequence" SET "seq" = "seq" + 1 WHERE "name" = 'object_id';

    UPDATE "user_token" SET "id" = build_object_id(${CONST.TOKEN_TYPE_TOKEN}, (SELECT "seq" FROM "_sequence" WHERE "name" = 'object_id')) WHERE "id" IS NULL;
END;

CREATE TRIGGER "user_token_after_delete_trigger" AFTER DELETE ON "user_token"
BEGIN
    DELETE FROM "user_hash" WHERE "id" = OLD."id";
END;

`;
