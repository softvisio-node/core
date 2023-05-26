import sql from "#lib/sql";

export default sql`

CREATE TABLE monitoring_method (
    id serial8 PRIMARY KEY,
    component text NOT NULL,
    method text NOT NULL,
    UNIQUE ( component, method )
);

CREATE TABLE monitoring_calls (
    monitoring_method_id int8 NOT NULL REFERENCES monitoring_method ( id ),
    date timestamptz NOT NULL,
    calls int4 NOT NULL,
    duration int8 NOT NULL,
    exceptions int4 NOT NULL,
    UNIQUE ( monitoring_method_id, date )
);

CREATE TABLE monitoring_method_exception (
    monitoring_method_id int8 NOT NULL REFERENCES monitoring_method ( id ),
    date timestamptz NOT NULL,
    status int4 NOT NULL,
    status_text text NOT NULL,
    duration int8 NOT NULL
);

CREATE INDEX monitoring_method_exception_monitoring_method_id_date_idx ON monitoring_method_exception ( monitoring_method_id, date );

`;
