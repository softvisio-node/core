const sql = require( "@softvisio/core/sql" );

const CONST = require( "../../../../../const" );

module.exports = sql`

-- HASH
CREATE TABLE "user_hash" (
    "id" int8 PRIMARY KEY NOT NULL,
    "hash" text NOT NULL
);

CREATE FUNCTION user_hash_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM "user_hash" WHERE "id" = OLD."id";

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- USER ID
CREATE SEQUENCE IF NOT EXISTS "auth_id_seq" AS int8 INCREMENT BY 1 MINVALUE 1 MAXVALUE 36028797018963967 NO CYCLE;

CREATE OR REPLACE FUNCTION gen_user_id() RETURNS int8 VOLATILE STRICT AS $$
BEGIN
    RETURN (SELECT overlay(nextval('auth_id_seq')::bit(64) PLACING ${CONST.AUTH_USER}::bit(8) FROM 2)::int8);
END;
$$ LANGUAGE "plpgsql";

-- TOKEN ID
CREATE OR REPLACE FUNCTION gen_token_id(_type integer) RETURNS int8 VOLATILE STRICT AS $$
BEGIN
    RETURN (SELECT overlay(nextval('auth_id_seq')::bit(64) PLACING _type::bit(8) FROM 2)::int8);
END;
$$ LANGUAGE "plpgsql";

-- USER
CREATE TABLE "user" (
    "id" int8 PRIMARY KEY NOT NULL DEFAULT gen_user_id(),
    "permissions" jsonb NOT NULL,
    "created" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" text NOT NULL UNIQUE,
    "enabled" bool NOT NULL DEFAULT TRUE,
    "email" text UNIQUE,
    "email_confirmed" bool NOT NULL DEFAULT FALSE,
    "gravatar" text,
    "telegram_name" text UNIQUE
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

CREATE TRIGGER "user_after_delete_trigger" AFTER DELETE ON "user" FOR EACH ROW EXECUTE PROCEDURE user_hash_delete_trigger();

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
