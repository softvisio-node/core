import sql from "#lib/sql";

export default sql`

CREATE TABLE api_health_call (
    method_id text NOT NULL,
    date timestamptz NOT NULL,
    duration int8 NOT NULL,
    call_count int4 NOT NULL,
    PRIMARY KEY ( method_id, date )
);

CREATE INDEX api_health_call_date_idx ON api_health_call ( date );

CREATE TABLE api_health_exception (
    method_id text NOT NULL,
    date timestamptz NOT NULL,
    status int4 NOT NULL,
    status_text text NOT NULL,
    duration int8 NOT NULL
);

CREATE INDEX api_health_exception_method_id_idx ON api_health_exception ( method_id );
CREATE INDEX api_health_exception_date_idx ON api_health_exception ( date );

`;
