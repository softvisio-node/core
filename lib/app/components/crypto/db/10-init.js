import sql from "#lib/sql";

export default sql`

CREATE TABLE crypto_storage (
    id serial4 PRIMARY KEY,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked bool NOT NULL DEFAILT FALSE,
    key text NOT NULL
);

-- XXX uniq revoked = FALSE index

`;
