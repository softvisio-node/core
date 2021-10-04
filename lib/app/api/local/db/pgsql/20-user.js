import sql from "#lib/sql";

export default sql`

-- user id
CREATE SEQUENCE IF NOT EXISTS userIdSeq AS int8 INCREMENT BY 1 MINVALUE 100 NO CYCLE;

-- user
CREATE TABLE "user" (
    "id" int8 PRIMARY KEY NOT NULL DEFAULT nextval('userIdSeq'),
    "permissions" jsonb NOT NULL,
    "created" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" text NOT NULL UNIQUE,
    "enabled" bool NOT NULL DEFAULT TRUE,
    "email" text UNIQUE,
    "emailConfirmed" bool NOT NULL DEFAULT FALSE,
    "gravatar" text,
    "telegramName" text UNIQUE
);

CREATE TABLE "userHash" (
    "userId" int8 PRIMARY KEY NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "hash" text NOT NULL
);

`;
