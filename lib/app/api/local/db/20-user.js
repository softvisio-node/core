import sql from "#lib/sql";

export default sql`

-- user id
CREATE SEQUENCE IF NOT EXISTS user_id_seq AS int8 INCREMENT BY 1 MINVALUE 100 NO CYCLE;

-- user
CREATE TABLE "user" (
    id int8 PRIMARY KEY DEFAULT nextval( 'user_id_seq' ),
    roles json,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity timestamptz,
    name text NOT NULL UNIQUE,
    enabled bool NOT NULL DEFAULT TRUE,
    email text UNIQUE,
    email_confirmed bool NOT NULL DEFAULT FALSE,
    gravatar text,
    telegram_username text UNIQUE
);

CREATE TABLE user_password_hash (
    user_id int8 PRIMARY KEY REFERENCES "user" ( id ) ON DELETE CASCADE,
    hash text NOT NULL
);

`;
