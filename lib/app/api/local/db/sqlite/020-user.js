const sql = require( "@softvisio/core/sql" );

const CONST = require( "../../../../../const" );

module.exports = {
    "functions": {
        build_object_id ( type, id ) {
            return ( type << 55n ) | id;
        },
    },
    "query": sql`

-- HASH
CREATE TABLE "user_hash" (
    "id" int8 PRIMARY KEY NOT NULL,
    "hash" text NOT NULL
);

-- USER ID
CREATE TABLE IF NOT EXISTS "_sequence" (
    "name" text PRIMARY KEY NOT NULL,
    "seq" int8 NOT NULL
);

INSERT OR IGNORE INTO "_sequence" ("name", "seq") VALUES ('auth_id', 0);

-- USER
CREATE TABLE "user" (
    "id" int8 PRIMARY KEY,
    "permissions" jsonb NOT NULL,
    "created" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" text NOT NULL UNIQUE,
    "enabled" bool NOT NULL DEFAULT TRUE,
    "email" text UNIQUE,
    "email_confirmed" bool NOT NULL DEFAULT FALSE,
    "gravatar" text,
    "telegram_name" text UNIQUE
);

CREATE TRIGGER "user_after_insert_trigger" AFTER INSERT ON "user"
WHEN NEW."id" IS NULL
BEGIN
    UPDATE "_sequence" SET "seq" = "seq" + 1 WHERE "name" = 'auth_id';

    UPDATE "user" SET "id" = build_object_id(${CONST.AUTH_USER}, (SELECT "seq" FROM "_sequence" WHERE "name" = 'auth_id')) WHERE "id" IS NULL;
END;

CREATE TRIGGER "user_before_insert_trigger" BEFORE INSERT ON "user"
BEGIN
    -- check, that "name" is unique in "email" column
    SELECT
        CASE WHEN
            EXISTS (SELECT 1 FROM "user" WHERE "email" = NEW."name")
        THEN
            RAISE(ABORT, 'Email is not unique.')
        END;

    -- check, that "email" is unique in "name" column
    SELECT
        CASE WHEN
            NEW."email" IS NOT NULL
        THEN
            CASE WHEN
                EXISTS (SELECT 1 FROM "user" WHERE "name" = NEW."email")
            THEN
                RAISE(ABORT, 'Email is not unique.')
            END
        END;
END;

CREATE TRIGGER "user_after_insert_trigger" AFTER INSERT ON "user"
BEGIN
    UPDATE "user" SET "email_confirmed" = FALSE, "gravatar" = md5(lower(NEW."email")) WHERE "id" = NEW."id";
END;

CREATE TRIGGER "user_after_delete_trigger" AFTER DELETE ON "user"
BEGIN
    DELETE FROM "user_hash" WHERE "id" = OLD."id";
END;

CREATE TRIGGER "user_name_before_update_trigger" BEFORE UPDATE OF "name" ON "user"
BEGIN
    -- check, that "name" is unique in "email" column
    SELECT CASE WHEN
        EXISTS (SELECT 1 FROM "user" WHERE "email" = NEW."name" AND "id" != NEW."id")
    THEN
        RAISE(ABORT, 'Email is not unique.')
    END;
END;

CREATE TRIGGER "user_email_before_update_trigger" BEFORE UPDATE OF "email" ON "user"
WHEN NEW."email" IS NOT NULL
BEGIN
    -- check, that "email" is unique in "name" column
    SELECT CASE WHEN
        EXITS (SELECT 1 FROM "user" WHERE "name" = NEW."email" AND "id" != NEW."id")
    THEN
        RAISE(ABORT, 'Email is not unique.')
    END;
END;

CREATE TRIGGER "user_email_after_update_trigger" AFTER UPDATE OF "email" ON "user"
BEGIN
    DELETE FROM "user_action_token" WHERE "email" = OLD."email";

    UPDATE "user" SET "email_confirmed" = FALSE, "gravatar" = md5(lower(NEW."email")) WHERE "id" = NEW."id";
END;

`,
};
