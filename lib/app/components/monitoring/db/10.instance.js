import sql from "#lib/sql";

export default sql`

CREATE TABLE monitoring_instance (
    id serial8 PRIMARY KEY,
    package_name text NOT NULL,
    service_name text NOT NULL,
    instance_id uuid NOT NULL UNIQUE,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX monitoring_instance_package_name_service_name_instance_id_idx ON monitoring_instance ( package_name, service_name, instance_id );

CREATE TABLE monitoring_instance_stats (
    monitoring_instance_id int8 NOT NULL REFERENCES monitoring_instance ( id ) ON DELETE CASCADE,
    date timestamptz NOT NULL,
    cpu_user_delta int8,
    cpu_system_delta int8,
    memory_used int8,
    memory_delta int8,
    fs_total int8,
    fs_free int8,
    fs_free_delta int8,
    UNIQUE ( monitoring_instance_id, date )
);

CREATE FUNCTION insert_monitoring_instance ( _package_name text, _service_name text, _instance_id uuid ) RETURNS int8 AS $$
DECLARE
    _id int8;
BEGIN

    SELECT
        id
    FROM
        monitoring_instance
    WHERE
        package_name = _package_name
        AND service_name = _service_name
        AND instance_id = _instance_id
    INTO
        _id;

    IF _id IS NULL THEN
        INSERT INTO
            monitoring_instance
        ( package_name, service_name, instance_id )
        VALUES
        ( _package_name, _service_name, _instance_id )
        ON CONFLICT ( instance_id ) DO UPDATE SET
            package_name = EXCLUDED.package_name,
            service_name = EXCLUDED.service_name
        RETURNING
            id
        INTO
            _id;

    END IF;

    RETURN _id;
END;
$$ LANGUAGE plpgsql;

-- after insert
CREATE FUNCTION monitoring_instance_stats_after_insert_trigger() RETURNS TRIGGER AS $$
BEGIN

    UPDATE monitoring_instance SET last_activity = CURRENT_TIMESTAMP WHERE id = NEW.monitoring_instance_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER monitoring_instance_stats_after_insert AFTER INSERT ON monitoring_instance_stats FOR EACH ROW EXECUTE FUNCTION monitoring_instance_stats_after_insert_trigger();

`;
