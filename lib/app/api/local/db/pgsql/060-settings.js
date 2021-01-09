const sql = require( "@softvisio/core/sql" );

module.exports = sql`

CREATE TABLE "settings" (
    "id" int2 PRIMARY KEY NOT NULL DEFAULT 1,

    -- APP URL
    "app_url" text,

    -- SMTP
    "smtp_from" text,
    "smtp_host" text,
    "smtp_port" int2,
    "smtp_username" text,
    "smtp_password" text,
    "smtp_tls" bool NOT NULL DEFAULT TRUE,

    -- TELEGRAM
    "telegram_bot_name" text,
    "telegram_bot_key" text,
    "telegram_bot_enabled" bool NOT NULL DEFAULT FALSE,
    "telegram_signin_enabled" bool NOT NULL DEFAULT FALSE
);

`;
