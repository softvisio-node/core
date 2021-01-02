const sql = require( "@softvisio/core/sql" );

module.exports = sql`

CREATE TABLE "settings" (
    "id" INT2 PRIMARY KEY NOT NULL DEFAULT 1,

    -- APP URL
    "app_url" TEXT,

    -- SMTP
    "smtp_from" TEXT,
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

`;
