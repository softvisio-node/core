import sql from "#lib/sql";

export default sql`

CREATE TABLE monitoring_instance (
    id serial8 PRIMARY KEY,
    package text NOT NULL,
    service text NOT NULL,
    instance uuid NOT NULL UNIQUE,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    memory_total int8,
    memory_free int8,
    fs_total int8,
    fs_free int8
);

CREATE INDEX monitoring_instance_package_service_instance_idx ON monitoring_instance ( package, service, instance );

CREATE TABLE monitoring_instance_stats (
    monitoring_instance int8 NOT NULL REFERENCES monitoring_instance ( id ) ON DELETE CASCADE,
    date timestamptz NOT NULL,
    cpu_user_delta int8,
    cpu_system_delta int8,
    memory_free int8,
    memory_rss int8,
    fs_total int8,
    fs_free int8,
    UNIQUE ( monitoring_instance, date )
);

CREATE FUNCTION insert_monitoring_instance ( _package text, _service text, _instance uuid ) RETURNS int8 AS $$
DECLARE
    _id int8;
BEGIN

    SELECT
        id
    FROM
        monitoring_instance
    WHERE
        package = _package
        AND service = _service
        AND instance = _instance
    INTO
        _id;

    IF _id IS NULL THEN
        INSERT INTO
            monitoring_instance
        ( package, service, instance )
        VALUES
        ( _package, _service, _instance )
        ON CONFLICT ( instance ) DO UPDATE SET
            package = EXCLUDED.package,
            service = EXCLUDED.service
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

    UPDATE monitoring_instance SET last_activity = CURRENT_TIMESTAMP WHERE id = NEW.monitoring_instance;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER monitoring_instance_stats_after_insert AFTER INSERT ON monitoring_instance_stats FOR EACH ROW EXECUTE FUNCTION monitoring_instance_stats_after_insert_trigger();

`;
