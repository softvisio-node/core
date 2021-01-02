const sql = require( "@softvisio/core/sql" );

module.exports = sql`

-- HASH
CREATE TABLE "user_hash" (
    "id" UUID PRIMARY KEY NOT NULL,
    "hash" TEXT NOT NULL
);

-- USER
CREATE TABLE "user" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    "guid" UUID UNIQUE NOT NULL DEFAULT(gen_random_uuid()),
    "permissions" JSONB NOT NULL,
    "created" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL UNIQUE,
    "enabled" BOOL NOT NULL DEFAULT TRUE,
    "email" TEXT UNIQUE,
    "email_confirmed" BOOL NOT NULL DEFAULT FALSE,
    "gravatar" TEXT,
    "telegram_name" TEXT UNIQUE
);

INSERT INTO "sqlite_sequence" ("name", "seq") VALUES ('user', 99);

CREATE TRIGGER "before_user_insert_trigger" BEFORE INSERT ON "user"
BEGIN
    -- check, that "name" is unique in "email" column
    SELECT CASE WHEN
        (SELECT COUNT(*) FROM "user" WHERE "email" = NEW."name") > 0
    THEN
        RAISE(ABORT, 'Email is not unique.')
    END;

    -- check, that "email" is unique in "name" column
    SELECT CASE WHEN NEW."email" IS NOT NULL THEN CASE WHEN
        (SELECT COUNT(*) FROM "user" WHERE "name" = NEW."email") > 0
    THEN
        RAISE(ABORT, 'Email is not unique.')
    END
    END;
END;

CREATE TRIGGER "after_user_insert_trigger" AFTER INSERT ON "user"
BEGIN
    UPDATE "user" SET "email_confirmed" = FALSE, "gravatar" = MD5(LOWER(NEW."email")) WHERE "id" = NEW."id";
END;

CREATE TRIGGER "user_after_delete_trigger" AFTER DELETE ON "user"
BEGIN
    DELETE FROM "user_hash" WHERE "id" = OLD."guid";
END;

CREATE TRIGGER "before_user_name_update_trigger" BEFORE UPDATE OF "name" ON "user"
BEGIN
    -- check, that "name" is unique in "email" column
    SELECT CASE WHEN
        (SELECT COUNT(*) FROM "user" WHERE "email" = NEW."name" AND "id" != NEW."id") > 0
    THEN
        RAISE(ABORT, 'Email is not unique.')
    END;
END;

CREATE TRIGGER "before_user_email_update_trigger" BEFORE UPDATE OF "email" ON "user"
WHEN NEW."email" IS NOT NULL
BEGIN
    -- check, that "email" is unique in "name" column
    SELECT CASE WHEN
        (SELECT COUNT(*) FROM "user" WHERE "name" = NEW."email" AND "id" != NEW."id") > 0
    THEN
        RAISE(ABORT, 'Email is not unique.')
    END;
END;

CREATE TRIGGER "after_user_email_update_trigger" AFTER UPDATE OF "email" ON "user"
BEGIN
    DELETE FROM "user_action_token" WHERE "email" = OLD."email";

    UPDATE "user" SET "email_confirmed" = FALSE, "gravatar" = MD5(LOWER(NEW."email")) WHERE "id" = NEW."id";
END;

`;
