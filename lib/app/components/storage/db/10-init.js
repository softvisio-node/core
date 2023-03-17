import sql from "#lib/sql";

export default sql`

CREATE TABLE IF NOT EXISTS storage_file (
    id serial8 PRIMARY KEY,
    hash text UNIQUE,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    links_count int8 NOT NULL DEFAULT 0,
    size int8 NOT NULL
);

CREATE TABLE IF NOT EXISTS storage_link (
    id serial8 PRIMARY KEY,
    name text NOT NULL UNIQUE,
    storage_file_id int8 NOT NULL REFERENCES storage_file ( id ) ON DELETE RESTRICT,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    headers json
);

CREATE FUNCTION storage_file_links_count_after_update_trigger () RETURNS TRIGGER AS $$
BEGIN

    IF NEW.links_count = 0 THEN
        UPDATE storage_file SET hash = NULL WHERE id = NEW.id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER storage_file_links_count_after_update AFTER UPDATE OF links_count ON storage_file FOR EACH ROW EXECUTE FUNCTION storage_file_links_count_after_update_trigger();

CREATE FUNCTION storage_link_after_insert_trigger () RETURNS TRIGGER AS $$
BEGIN

    UPDATE storage_file SET links_count = links_count + 1 WHERE id = storage_file_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER storage_link_after_insert AFTER INSERT ON storage_link FOR EACH ROW EXECUTE FUNCTION storage_link_after_insert_trigger();

CREATE FUNCTION storage_link_after_update_trigger () RETURNS TRIGGER AS $$
BEGIN

    IF OLD.storage_file_id != NEW.storage_file_id THEN
        UPDATE storage_file SET links_count = links_count - 1 WHERE id = OLD.storage_file_id;

        UPDATE storage_file SET links_count = links_count + 1 WHERE id = NEW.storage_file_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER storage_link_after_update AFTER UPDATE ( storage_file_id ) ON storage_link FOR EACH ROW EXECUTE FUNCTION storage_link_after_update_trigger();

CREATE FUNCTION storage_link_after_delete_trigger () RETURNS TRIGGER AS $$
BEGIN

    UPDATE storage_file SET links_count = links_count - 1 WHERE id = OLD.storage_file_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER storage_link_after_delete AFTER DELETE ON storage_link FOR EACH ROW EXECUTE FUNCTION storage_link_after_delete_trigger();

`;
