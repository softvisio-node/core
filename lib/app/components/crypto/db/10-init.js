import sql from "#lib/sql";

export default sql`

CREATE TABLE crypto_key (
    id serial4 PRIMARY KEY,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    type text NOT NULL,
    enabled bool NOT NULL,
    key text NOT NULL
);

`;
