const sql = require( "@softvisio/core/sql" );

const CONST = require( "../../../../../const" );

module.exports = sql`

-- HASH
CREATE TABLE "user_hash" (
    "id" INT8 PRIMARY KEY NOT NULL,
    "hash" TEXT NOT NULL
);

CREATE FUNCTION api_delete_hash() RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM "user_hash" WHERE "id" = OLD."id";

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- USER ID
CREATE SEQUENCE IF NOT EXISTS "auth_id_seq" AS INT8 INCREMENT BY 1 MINVALUE 1 MAXVALUE 36028797018963967 NO CYCLE;

CREATE OR REPLACE FUNCTION gen_user_id() RETURNS INT8 VOLATILE STRICT AS $$
BEGIN
    RETURN (SELECT OVERLAY(nextval('auth_id_seq')::bit(64) PLACING ${CONST.AUTH_USER}::bit(8) FROM 2)::int8);
END;
$$ LANGUAGE "plpgsql";

CREATE OR REPLACE FUNCTION gen_token_id(_type INTEGER) RETURNS INT8 VOLATILE STRICT AS $$
BEGIN
    RETURN (SELECT OVERLAY(nextval('auth_id_seq')::bit(64) PLACING _type::bit(8) FROM 2)::int8);
END;
$$ LANGUAGE "plpgsql";

-- USER
CREATE TABLE "user" (
    "id" INT8 PRIMARY KEY NOT NULL DEFAULT gen_user_id(),
    "permissions" JSONB NOT NULL,
    "created" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL UNIQUE,
    "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
    "email" TEXT UNIQUE,
    "email_confirmed" BOOL NOT NULL DEFAULT FALSE,
    "gravatar" TEXT,
    "telegram_name" TEXT UNIQUE
);

CREATE FUNCTION api_before_insert_user() RETURNS TRIGGER AS $$
BEGIN

    -- check, that "name" is unique in "email" column
    IF (SELECT COUNT(*) FROM "user" WHERE "email" = NEW."name") > 0 THEN
        RAISE EXCEPTION 'Email is not unique.';
    END IF;

    -- check, that "email" is unique in "name" column
    IF NEW."email" IS NOT NULL AND (SELECT COUNT(*) FROM "user" WHERE "name" = NEW."email") > 0 THEN
        RAISE EXCEPTION 'Email is not unique.';
    END IF;

    NEW."email_confirmed" = FALSE;
    NEW."gravatar" = MD5(LOWER(NEW."email"));

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "before_insert_user_trigger" BEFORE INSERT ON "user" FOR EACH ROW EXECUTE PROCEDURE api_before_insert_user();

CREATE FUNCTION api_delete_user() RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM "user_hash" WHERE "id" = OLD."id";

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "user_after_delete_trigger" AFTER DELETE ON "user" FOR EACH ROW EXECUTE PROCEDURE api_delete_user();

CREATE OR REPLACE FUNCTION before_user_name_update() RETURNS TRIGGER AS $$
BEGIN
    -- check, that "name" is unique in "email" column
    IF (SELECT COUNT(*) FROM "user" WHERE "email" = NEW."name" AND "id" != NEW."id") > 0 THEN
        RAISE EXCEPTION 'Email is not unique.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "before_user_name_update_trigger" BEFORE UPDATE OF "name" ON "user" FOR EACH ROW EXECUTE PROCEDURE before_user_name_update();

CREATE OR REPLACE FUNCTION before_user_email_update() RETURNS TRIGGER AS $$
BEGIN
    -- check, that "email" is unique in "name" column
    IF NEW."email" IS NOT NULL AND (SELECT COUNT(*) FROM "user" WHERE "name" = NEW."email" AND "id" != NEW."id") > 0 THEN
        RAISE EXCEPTION 'Email is not unique.';
    END IF;

    DELETE FROM "user_action_token" WHERE "email" = OLD."email";

    NEW."email_confirmed" = FALSE;
    NEW."gravatar" = MD5(LOWER(NEW."email"));

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "before_user_email_update_trigger" BEFORE UPDATE OF "email" ON "user" FOR EACH ROW EXECUTE PROCEDURE before_user_email_update();

`;
