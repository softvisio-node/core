import sql from "#lib/sql";

export default sql`

CREATE TABLE monitoring_service (
    id serial8 PRIMARY KEY,
    instance text NOT NULL,
    service text,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ( instance )
);

CREATE TABLE monitoring_instance_stats (
    monitoring_method_id int8 NOT NULL REFERENCES monitoring_method ( id ) ON DELETE CASCADE,
    date timestamptz NOT NULL,
    calls int4 NOT NULL,
    duration float8 NOT NULL, -- XXX
    exceptions int4 NOT NULL,
    UNIQUE ( monitoring_method_id, date )
);

CREATE FUNCTION insert_monitoring_instance ( _instance text, _service text ) RETURNS int8 AS $$
DECLARE
    _id int8;
BEGIN

    SELECT id FROM monitoring_instance WHERE instance = _instance INTO _id;

    IF _id IS NULL THEN
        INSERT INTO monitoring_instance ( instances, service ) VALUES ( _instance, _service ) RETURNING id INTO _id;
    END IF;

    RETURN _id;
END;
$$ LANGUAGE plpgsql;

`;
