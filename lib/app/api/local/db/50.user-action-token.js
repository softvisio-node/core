import sql from "#lib/sql";

export default sql`

CREATE TABLE user_action_token (
    id serial8 PRIMARY KEY,
    user_id int8 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    type int2 NOT NULL,
    email text NOT NULL,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires timestamptz NOT NULL
);

CREATE TABLE user_action_token_hash (
    user_action_token_id int8 PRIMARY KEY REFERENCES user_action_token ( id ) ON DELETE CASCADE,
    hash text NOT NULL
);

`;
