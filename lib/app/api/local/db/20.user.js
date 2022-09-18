import sql from "#lib/sql";

export default sql`

-- user id
CREATE SEQUENCE IF NOT EXISTS user_id_seq AS int8 INCREMENT BY 1 MINVALUE 100 NO CYCLE;

-- user
CREATE TABLE "user" (
    id int8 PRIMARY KEY DEFAULT nextval( 'user_id_seq' ),
    email text NOT NULL UNIQUE,
    roles json,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity timestamptz,
    enabled bool NOT NULL DEFAULT TRUE,
    locale text,
    email_confirmed bool NOT NULL DEFAULT FALSE,
    gravatar text,
    telegram_username text UNIQUE,
    telegram_connected bool NOT NULL DEFAULT FALSE
);

CREATE TABLE user_password_hash (
    user_id int8 PRIMARY KEY REFERENCES "user" ( id ) ON DELETE CASCADE,
    hash text NOT NULL
);

`;
