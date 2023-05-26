import sql from "#lib/sql";

export default sql`

CREATE TABLE monitoring_calls (
    component text NOT NULL,
    method text NOT NULL,
    date timestamptz NOT NULL,
    calls int4 NOT NULL,
    duration int8 NOT NULL,
    exceptions int4 NOT NULL,
    PRIMARY KEY ( component, method, date )
);

CREATE TABLE monitoring_exception (
    component text NOT NULL,
    method text NOT NULL,
    date timestamptz NOT NULL,
    status int4 NOT NULL,
    status_text text NOT NULL,
    duration int8 NOT NULL
);

CREATE INDEX monitoring_exception_component_method_date_idx ON monitoring_exception ( component, method, date );

`;
