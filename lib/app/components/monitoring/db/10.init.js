import sql from "#lib/sql";

export default sql`

CREATE TABLE api_monitoring (
    method_id text NOT NULL,
    date timestamptz NOT NULL,
    calls int4 NOT NULL,
    duration int8 NOT NULL,
    exceptions int4 NOT NULL,
    PRIMARY KEY ( method_id, date )
);

CREATE INDEX api_monitoring_date_idx ON api_monitoring ( date );

CREATE TABLE api_monitoring_exception (
    method_id text NOT NULL,
    date timestamptz NOT NULL,
    status int4 NOT NULL,
    status_text text NOT NULL,
    duration int8 NOT NULL
);

CREATE INDEX api_monitoring_exception_method_id_idx ON api_monitoring_exception ( method_id );
CREATE INDEX api_monitoring_exception_date_idx ON api_monitoring_exception ( date );

`;
