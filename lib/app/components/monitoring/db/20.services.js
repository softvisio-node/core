import sql from "#lib/sql";

export default sql`

CREATE TABLE monitoring_service (
    id serial8 PRIMARY KEY,
    instance uuid NOT NULL UNIQUE,
    service text,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE monitoring_instance_stats (
    monitoring_instance_id int8 NOT NULL REFERENCES monitoring_instance ( id ) ON DELETE CASCADE,
    date timestamptz NOT NULL,
    cou_user_delta int8,
    cpu_system_delta int8,
    memory_used int8,
    memory_delta int8,
    fs_total int8,
    fs_free int8,
    fs_free_delta int8,
    UNIQUE ( monitoring_instance_id, date )
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
