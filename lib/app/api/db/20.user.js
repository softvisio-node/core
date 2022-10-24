import sql from "#lib/sql";

export default sql`

-- user
CREATE TABLE "user" (
    id serial8 PRIMARY KEY,
    email text NOT NULL UNIQUE,
    roles json,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity timestamptz,
    enabled bool NOT NULL DEFAULT TRUE,
    locale text,
    email_confirmed bool NOT NULL DEFAULT FALSE,
    gravatar text,
    telegram_username text UNIQUE,
    telegram_user_id int8
);

CREATE TABLE user_password_hash (
    user_id int8 PRIMARY KEY REFERENCES "user" ( id ) ON DELETE CASCADE,
    hash text NOT NULL
);

`;
