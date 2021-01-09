const sql = require( "@softvisio/core/sql" );

const CONST = require( "../../../../../const" );

module.exports = sql`

CREATE TABLE "user_token" (
    "id" int8 PRIMARY KEY,
    "user_id" int8 NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "permissions" jsonb NOT NULL,
    "name" text,
    "enabled" bool NOT NULL DEFAULT TRUE,
    "created" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER "user_token_after_insert_trigger" AFTER INSERT ON "user_token"
BEGIN
    UPDATE "_sequence" SET "seq" = "seq" + 1 WHERE "name" = 'auth_id';

    UPDATE "user_token" SET "id" = build_object_id(${CONST.AUTH_TOKEN}, (SELECT "seq" FROM "_sequence" WHERE "name" = 'auth_id')) WHERE "id" IS NULL;
END;

CREATE TRIGGER "user_token_after_delete_trigger" AFTER DELETE ON "user_token"
BEGIN
    DELETE FROM "user_hash" WHERE "id" = OLD."id";
END;

`;
