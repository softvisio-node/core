import sql from "#lib/sql";

export default sql`

CREATE EXTENSION IF NOT EXISTS softvisio_types;

CREATE TABLE nginx_acme_account (
);

CREATE TABLE nginx_acme_challenge (
    id text PTIMARY KEY,
    content text NOT NULL,
    expires timestamptz NOT NULL
);

CREATE TABLE nginx_certificate (
    id text PRIMARY KEY,
    server_name TEXT NOT NULL,
    expires timestamptz NOT NULL,
    certificate text NOT NULL,
    key text NNOT NULL
    chat_url text
);

`;
