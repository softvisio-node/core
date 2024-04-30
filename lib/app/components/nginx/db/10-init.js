import sql from "#lib/sql";

export default sql`

CREATE EXTENSION IF NOT EXISTS softvisio_types;

CREATE TABLE nginx_acme_account (
    email text NOT NULL,
    test bool NOT NULL,
    url text NOT NULL,
    key bytea NOT NULL,
    PRIMARY KEY ( email, test )
);

CREATE TABLE nginx_acme_challenge (
    id text PTIMARY KEY,
    content text NOT NULL,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE nginx_certificate (
    hash text NOT NULL,
    test bool NOT NULL,
    expires timestamptz NOT NULL,
    certificate bytea NOT NULL,
    key bytea NNOT NULL,
    PRIMARY KEY ( hash, test )
);

`;
