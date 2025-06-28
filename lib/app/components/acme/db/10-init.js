import sql from "#lib/sql";

export default sql`

CREATE TABLE acme_account (
    email text NOT NULL,
    test boolean NOT NULL,
    url text NOT NULL,
    key bytea NOT NULL,
    PRIMARY KEY ( email, test )
);

CREATE TABLE acme_challenge (
    id text PRIMARY KEY,
    content text NOT NULL,
    expires timestamptz NOT NULL
);

CREATE TABLE acme_certificate (
    domains text NOT NULL,
    test boolean NOT NULL,
    expires timestamptz NOT NULL,
    certificate bytea NOT NULL,
    key bytea NOT NULL,
    PRIMARY KEY ( domains, test )
);

`;
