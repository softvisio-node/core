import sql from "#lib/sql";

export default sql`

CREATE TABLE health_api_call (
    method_id text NOT NULL,
    date timestamptz NOT NULL,
    duration int8 NOT NULL,
    call_count int4 NOT NULL,
    PRIMARY KEY ( method_id, date )
);

CREATE INDEX health_api_call_date_idx ON health_api_call ( date );

CREATE TABLE health_api_exception (
    method_id text NOT NULL,
    date timestamptz NOT NULL,
    status int4 NOT NULL,
    status_text text NOT NULL,
    duration int8 NOT NULL
);

CREATE INDEX health_api_exception_date_idx ON health_api_exceptionl ( date );

`;
