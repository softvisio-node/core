import sql from "#lib/sql";

export default sql`

CREATE TABLE user_token (
    id serial8 PRIMARY KEY NOT NULL,
    user_id int8 NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    permissions jsonb NOT NULL,
    name text,
    enabled bool NOT NULL DEFAULT TRUE,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_token_hash (
    user_token_id int8 PRIMARY KEY NOT NULL REFERENCES user_token ( id ) ON DELETE CASCADE,
    hash text NOT NULL
);

`;
