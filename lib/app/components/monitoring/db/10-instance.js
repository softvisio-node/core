import sql from "#lib/sql";

export default sql`

CREATE EXTENSION IF NOT EXISTS softvisio_types;

CREATE SEQUENCE monitoring_instance_id_seq AS int8 MAXVALUE ${ Number.MAX_SAFE_INTEGER };

CREATE TABLE monitoring_instance (
    id int53 PRIMARY KEY DEFAULT nextval( 'monitoring_instance_id_seq' ),
    package text NOT NULL,
    service text NOT NULL,
    instance uuid NOT NULL UNIQUE,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_updated timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ram_total int53,
    ram_used int53,
    rss_used int53,
    hdd_total int53,
    hdd_used int53
);

ALTER SEQUENCE monitoring_instance_id_seq OWNED BY monitoring_instance.id;

CREATE INDEX monitoring_instance_package_service_instance_idx ON monitoring_instance ( package, service, instance );

CREATE TABLE monitoring_instance_stats (
    monitoring_instance_id int53 NOT NULL REFERENCES monitoring_instance ( id ) ON DELETE CASCADE,
    date timestamptz NOT NULL,
    cpu_used number2,
    ram_used int53,
    ram_used_percent number2,
    rss_used int53,
    rss_used_percent number2,
    hdd_used int53,
    hdd_used_percent number2,
    UNIQUE ( monitoring_instance_id, date )
);

CREATE FUNCTION insert_monitoring_instance ( _package text, _service text, _instance uuid, _ram_total int53, _hdd_total int53 ) RETURNS int53 AS $$
DECLARE
    _id int53;
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
        ( package, service, instance, ram_total, hdd_total )
        VALUES
        ( _package, _service, _instance, _ram_total, _hdd_total )
        ON CONFLICT ( instance ) DO UPDATE SET
            package = EXCLUDED.package,
            service = EXCLUDED.service,
            ram_total = _ram_total,
            hdd_total = _hdd_total
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

    UPDATE
        monitoring_instance
    SET
        last_updated = CURRENT_TIMESTAMP,
        ram_used = NEW.ram_used,
        rss_used = NEW.rss_used,
        hdd_used = NEW.hdd_used
    WHERE
        id = NEW.monitoring_instance_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER monitoring_instance_stats_after_insert AFTER INSERT ON monitoring_instance_stats FOR EACH ROW EXECUTE FUNCTION monitoring_instance_stats_after_insert_trigger();

`;
