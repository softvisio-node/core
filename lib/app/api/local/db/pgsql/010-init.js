const sql = require( "@softvisio/core/sql" );

module.exports = sql`

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- HASH
CREATE TABLE "auth_hash" (
    "id" UUID PRIMARY KEY NOT NULL,
    "hash" TEXT NOT NULL
);

-- USER
CREATE SEQUENCE "user_id_seq" AS INT4 INCREMENT BY 1 START 100;

CREATE TABLE "user" (
    "id" INT4 PRIMARY KEY NOT NULL DEFAULT NEXTVAL('user_id_seq'),
    "guid" UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
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
    DELETE FROM "auth_hash" WHERE "id" = OLD."guid";

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

-- USER TOKEN
CREATE TABLE "user_token" (
    "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INT4 NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "permissions" JSONB NOT NULL,
    "name" TEXT,
    "enabled" BOOL NOT NULL DEFAULT TRUE,
    "created" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE FUNCTION api_delete_hash() RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM "auth_hash" WHERE "id" = OLD."id";

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "user_token_after_delete_trigger" AFTER DELETE ON "user_token" FOR EACH ROW EXECUTE PROCEDURE api_delete_hash();

-- USER SESSION
CREATE TABLE "user_session" (
    "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INT4 NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "created" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER "user_session_after_delete_trigger" AFTER DELETE ON "user_session" FOR EACH ROW EXECUTE PROCEDURE api_delete_hash();

-- USER ACTION TOKEN
CREATE TABLE "user_action_token" (
    "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INT4 NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "type" INT2 NOT NULL,
    "email" TEXT NOT NULL,
    "created" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER "user_action_token_after_delete_trigger" AFTER DELETE ON "user_action_token" FOR EACH ROW EXECUTE PROCEDURE api_delete_hash();

-- USER OBJECT PERMISSIONS
CREATE TABLE "object_permissions" (
    "user_id" INT4 NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "object_id" UUID NOT NULL,
    "permissions" JSONB NOT NULL,
    "created" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("user_id", "object_id")
);

-- SETTINGS
CREATE TABLE "settings" (
    "id" INT2 PRIMARY KEY NOT NULL DEFAULT 1,

    -- APP URL
    "app_url" TEXT,

    -- SMTP
    "smtp_host" TEXT,
    "smtp_port" INT2,
    "smtp_username" TEXT,
    "smtp_password" TEXT,
    "smtp_tls" BOOL NOT NULL DEFAULT TRUE,

    -- TELEGRAM
    "telegram_bot_name" TEXT,
    "telegram_bot_key" TEXT,
    "telegram_bot_enabled" BOOL NOT NULL DEFAULT FALSE,
    "telegram_signin_enabled" BOOL NOT NULL DEFAULT FALSE
);

INSERT INTO "settings" ("app_url", "smtp_host", "smtp_port", "smtp_tls") VALUES ('http://localhost/', 'smtp.gmail.com', 465, TRUE);

`;
