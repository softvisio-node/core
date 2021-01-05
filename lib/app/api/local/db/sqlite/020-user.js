const sql = require( "@softvisio/core/sql" );

const CONST = require( "../../../../../const" );

module.exports = {
    "sqlite": {
        "functions": {
            build_object_id ( type, id ) {
                const buf = Buffer.allocUnsafe( 8 );

                buf.writeBigUInt64BE( id );
                buf.writeUInt8( Number( type ) );

                return buf.readBigUInt64BE();
            },
        },
        "query": sql`

-- HASH
CREATE TABLE "user_hash" (
    "id" INT8 PRIMARY KEY NOT NULL,
    "hash" TEXT NOT NULL
);

-- USER ID
CREATE TABLE IF NOT EXISTS "_sequence" (
    "name" TEXT PRIMARY KEY NOT NULL,
    "seq" INT8 NOT NULL
);

INSERT OR IGNORE INTO "_sequence" ("name", "seq") VALUES ('object_id', 0);

-- USER
CREATE TABLE "user" (
    "id" INT8 PRIMARY KEY,
    "permissions" JSONB NOT NULL,
    "created" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL UNIQUE,
    "enabled" BOOL NOT NULL DEFAULT TRUE,
    "email" TEXT UNIQUE,
    "email_confirmed" BOOL NOT NULL DEFAULT FALSE,
    "gravatar" TEXT,
    "telegram_name" TEXT UNIQUE
);

CREATE TRIGGER "after_insert_user_id_trigger" AFTER INSERT ON "user"
WHEN NEW."id" IS NULL
BEGIN
    UPDATE "_sequence" SET "seq" = "seq" + 1 WHERE "name" = 'object_id';

    UPDATE "user" SET "id" = build_object_id(${CONST.TOKEN_TYPE_PASSWORD}, (SELECT "seq" FROM "_sequence" WHERE "name" = 'object_id')) WHERE "id" IS NULL;
END;

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
    DELETE FROM "user_hash" WHERE "id" = OLD."id";
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

`,
    },
};
