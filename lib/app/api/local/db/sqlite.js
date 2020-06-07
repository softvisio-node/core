const sql = require( "@softvisio/core/lib/sql" );

module.exports = sql`

-- HASH
CREATE TABLE "auth_hash" (
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
    "locale" TEXT,
    "telegram_name" TEXT UNIQUE
);

INSERT INTO "sqlite_sequence" ("name", "seq") VALUES ('user', 99);

CREATE TRIGGER "user_after_delete_trigger" AFTER DELETE ON "user"
BEGIN
    DELETE FROM "auth_hash" WHERE "id" = OLD."guid";
END;

CREATE TRIGGER "on_user_email_update_trigger" AFTER UPDATE ON "user"
WHEN COALESCE(OLD."email", '') != COALESCE(NEW."email", '')
BEGIN
    DELETE FROM "user_action_token" WHERE "email" = OLD."email";
    UPDATE "user" SET "email_confirmed" = FALSE, "gravatar" = MD5(LOWER(NEW."email")) WHERE "id" = NEW."id";
END;

-- USER TOKEN
CREATE TABLE "user_token" (
    "id" UUID PRIMARY KEY NOT NULL DEFAULT(gen_random_uuid()),
    "user_id" INT4 NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "permissions" JSONB NOT NULL,
    "name" TEXT,
    "enabled" BOOL NOT NULL DEFAULT TRUE,
    "created" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER "user_token_after_delete_trigger" AFTER DELETE ON "user_token"
BEGIN
    DELETE FROM "auth_hash" WHERE "id" = OLD."id";
END;

-- USER SESSION
CREATE TABLE "user_session" (
    "id" UUID PRIMARY KEY NOT NULL DEFAULT(gen_random_uuid()),
    "user_id" INT4 NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "created" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER "user_session_after_delete_trigger" AFTER DELETE ON "user_session"
BEGIN
    DELETE FROM "auth_hash" WHERE "id" = OLD."id";
END;

-- USER ACTION TOKEN
CREATE TABLE "user_action_token" (
    "id" UUID PRIMARY KEY NOT NULL DEFAULT(gen_random_uuid()),
    "user_id" INT4 NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "type" INT2 NOT NULL,
    "email" TEXT NOT NULL,
    "created" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER "user_action_token_after_delete_trigger" AFTER DELETE ON "user_action_token"
BEGIN
    DELETE FROM "auth_hash" WHERE "id" = OLD."id";
END;

-- USER OBJECT PERMISSIONS
CREATE TABLE "object_permissions" (
    "user_id" INTEGER NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "object_id" UUID NOT NULL,
    "permissions" JSONB NOT NULL,
    "created" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("user_id", "object_id")
);

-- SETTINGS
CREATE TABLE "settings" (
    "id" INT2 PRIMARY KEY NOT NULL DEFAULT 1,

    -- DOMAIN
    "domain" TEXT,

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

INSERT INTO "settings" ("smtp_host", "smtp_port", "smtp_tls") VALUES ('smtp.gmail.com', 465, TRUE);

`;
