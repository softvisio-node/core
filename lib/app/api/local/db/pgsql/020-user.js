const sql = require( "@softvisio/core/sql" );

// const CONST = require( "../../../../../const" );

module.exports = sql`

-- USER ID
CREATE SEQUENCE IF NOT EXISTS "user_id_seq" AS int8 INCREMENT BY 1 MINVALUE 100 NO CYCLE;

-- USER
CREATE TABLE "user" (
    "id" int8 PRIMARY KEY NOT NULL DEFAULT nextval('user_id_seq'),
    "permissions" jsonb NOT NULL,
    "created" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" text NOT NULL UNIQUE,
    "enabled" bool NOT NULL DEFAULT TRUE,
    "email" text UNIQUE,
    "email_confirmed" bool NOT NULL DEFAULT FALSE,
    "gravatar" text,
    "telegram_name" text UNIQUE
);

CREATE TABLE "user_hash" (
    "user_id" int8 PRIMARY KEY NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "hash" text NOT NULL
);

CREATE FUNCTION user_before_insert_trigger() RETURNS TRIGGER AS $$
BEGIN

    -- check, that "name" is unique in "email" column
    IF EXISTS (SELECT 1 FROM "user" WHERE "email" = NEW."name") THEN
        RAISE EXCEPTION 'Email is not unique.';
    END IF;

    -- check, that "email" is unique in "name" column
    IF NEW."email" IS NOT NULL AND EXISTS (SELECT 1 FROM "user" WHERE "name" = NEW."email") THEN
        RAISE EXCEPTION 'Email is not unique.';
    END IF;

    NEW."email_confirmed" = FALSE;
    NEW."gravatar" = md5(lower(NEW."email"));

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "user_before_insert_trigger" BEFORE INSERT ON "user" FOR EACH ROW EXECUTE PROCEDURE user_before_insert_trigger();

CREATE OR REPLACE FUNCTION user_name_before_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    -- check, that "name" is unique in "email" column
    IF EXISTS (SELECT 1 FROM "user" WHERE "email" = NEW."name" AND "id" != NEW."id") THEN
        RAISE EXCEPTION 'Email is not unique.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "user_name_before_update_trigger" BEFORE UPDATE OF "name" ON "user" FOR EACH ROW EXECUTE PROCEDURE user_name_before_update_trigger();

CREATE OR REPLACE FUNCTION user_email_before_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    -- check, that "email" is unique in "name" column
    IF NEW."email" IS NOT NULL AND EXISTS (SELECT 1 FROM "user" WHERE "name" = NEW."email" AND "id" != NEW."id") THEN
        RAISE EXCEPTION 'Email is not unique.';
    END IF;

    DELETE FROM "user_action_token" WHERE "email" = OLD."email";

    NEW."email_confirmed" = FALSE;
    NEW."gravatar" = md5(lower(NEW."email"));

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "user_email_before_update_trigger" BEFORE UPDATE OF "email" ON "user" FOR EACH ROW EXECUTE PROCEDURE user_email_before_update_trigger();

`;
