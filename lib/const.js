export * from "#lib/const/common";

export const SQL_MIGRATION_TABLE_NAME = "__migration";
export const SQL_MIGRATION_DEFAULT_MODULE = "main";
export const SQL_TYPE = Symbol();
export const SQL_LOCKS = Object.freeze( {
    "MIGRATION": -1,
} );

export const AUTH_USER = 1;
export const AUTH_TOKEN = 2;
export const AUTH_SESSION = 3;
export const AUTH_EMAIL_CONFIRM = 4;
export const AUTH_PASSWORD_RESET = 5;
