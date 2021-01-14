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
    "user_id" int8 PRIMARY KEY NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "hash" text NOT NULL
);

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
        EXISTS (SELECT 1 FROM "user" WHERE "name" = NEW."email" AND "id" != NEW."id")
    THEN
        RAISE(ABORT, 'Email is not unique.')
    END;
END;

CREATE TRIGGER "user_email_after_update_trigger" AFTER UPDATE OF "email" ON "user"
BEGIN
    DELETE FROM "user_action_token" WHERE "email" = OLD."email";

    UPDATE "user" SET "email_confirmed" = FALSE, "gravatar" = md5(lower(NEW."email")) WHERE "id" = NEW."id";
END;

`;
