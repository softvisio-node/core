import sql from "#lib/sql";

export default sql`

DROP FUNCTION insert_monitoring_instance;

DROP FUNCTION monitoring_instance_stats_after_insert_trigger;

ALTER TABLE monitoring_instance
    RENAME COLUMN memory_total TO ram_total
    RENAME COLUMN memory_used TO ram_used
    RENAME COLUMN memory_rss TO rss_used
    RENAME COLUMN fs_total TO hdd_total
    RENAME COLUMN fs_used TO hdd_used
;

ALTER TABLE monitoring_instance_stats
    RENAME COLUMN memory_used TO ram_used
    RENAME COLUMN memory_used_percent TO ram_used_percent
    RENAME COLUMN memory_rss TO rss_used
    RENAME COLUMN memory_rss_percent TO rss_used_percent
    RENAME COLUMN fs_used TO hdd_used
    RENAME COLUMN fs_used_percent TO hdd_used_percent
;

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

`;
