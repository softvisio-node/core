import sql from "#lib/sql";

export default sql`

CREATE TABLE crypto_key (
    id serial4 PRIMARY KEY,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked bool NOT NULL DEFAULT FALSE,
    key text NOT NULL
);

CREATE UNIQUE INDEX crypto_key_revoked_key ON crypto_key ( revoked ) WHERE revoked = TRUE;

`;
