import sql from "#lib/sql";

export default sql`

CREATE TABLE api_monitoring (
    component text NOT NULL,
    entity text NOT NULL,
    date timestamptz NOT NULL,
    calls int4 NOT NULL,
    duration int8 NOT NULL,
    exceptions int4 NOT NULL,
    PRIMARY KEY ( component, entity, date )
);

CREATE TABLE api_monitoring_exception (
    component text NOT NULL,
    entity text NOT NULL,
    date timestamptz NOT NULL,
    status int4 NOT NULL,
    status_text text NOT NULL,
    duration int8 NOT NULL
);

CREATE INDEX api_monitoring_exception_component_entity_date_idx ON api_monitoring_exception ( component, entity, date );

`;
