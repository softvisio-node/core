import sql from "#lib/sql";

export default sql`

CREATE TABLE monitoring_method (
    id serial8 PRIMARY KEY,
    package text NOT NULL,
    component text NOT NULL,
    method text NOT NULL,
    UNIQUE ( package, component, method )
);

CREATE TABLE monitoring_method_stats (
    monitoring_method_id int8 NOT NULL REFERENCES monitoring_method ( id ) ON DELETE CASCADE,
    date timestamptz NOT NULL,
    calls int4 NOT NULL,
    duration float8 NOT NULL, -- XXX
    exceptions int4 NOT NULL,
    UNIQUE ( monitoring_method_id, date )
);

CREATE TABLE monitoring_method_exception (
    monitoring_method_id int8 NOT NULL REFERENCES monitoring_method ( id ) ON DELETE CASCADE,
    date timestamptz NOT NULL,
    status int4 NOT NULL,
    status_text text NOT NULL,
    duration float8 NOT NULL
);

CREATE INDEX monitoring_method_exception_monitoring_method_id_date_idx ON monitoring_method_exception ( monitoring_method_id, date );

CREATE FUNCTION insert_monitoring_method ( _package text, _component text, _method text ) RETURNS int8 AS $$
DECLARE
    _id int8;
BEGIN

    SELECT id FROM monitoring_method WHERE package = _package AND component = _component AND method = _method INTO _id;

    IF _id IS NULL THEN
        INSERT INTO monitoring_method ( package, component, method ) VALUES ( _package, _component, _method ) RETURNING id INTO _id;
    END IF;

    RETURN _id;
END;
$$ LANGUAGE plpgsql;

`;
