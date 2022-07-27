import sql from "#lib/sql";

export default sql`

CREATE TABLE IF NOT EXISTS static_files_file (
    id serial8 PRIMARY KEY,
    guid uuid UNIQUE DEFAULT gen_random_uuid(),
    hash text UNIQUE,
    created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    links_count int8 NOT NULL DEFAULT 0,
    size int8 NOT NULL
);

CREATE TABLE IF NOT EXISTS static_files_link (
    id serial8 PRIMARY KEY,
    guid uuid UNIQUE DEFAULT gen_random_uuid(),
    static_files_file_id int8 NOT NULL REFERENCES static_files_file ( id ) ON DELETE RESTRICT,
    created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    type text NOT NULL,
    name text,
    headers json
);

CREATE FUNCTION static_files_file_links_count_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    IF NEW.links_count = 0 THEN
        UPDATE static_files_file SET hash = NULL WHERE id = NEW.id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER static_files_file_links_count_after_update AFTER UPDATE OF links_count ON static_files_file FOR EACH ROW EXECUTE FUNCTION static_files_file_links_count_after_update_trigger();

CREATE FUNCTION static_files_link_after_insert_trigger() RETURNS TRIGGER AS $$
BEGIN

    UPDATE static_files_file SET links_count = links_count + 1 WHERE id = NEW.static_files_file_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER static_files_link_after_insert AFTER INSERT ON static_files_link FOR EACH ROW EXECUTE FUNCTION static_files_link_after_insert_trigger();

CREATE FUNCTION static_files_link_after_delete_trigger() RETURNS TRIGGER AS $$
BEGIN

    UPDATE static_files_file SET links_count = links_count - 1 WHERE id = OLD.static_files_file_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER static_files_link_after_delete AFTER DELETE ON static_files_link FOR EACH ROW EXECUTE FUNCTION static_files_link_after_delete_trigger();

`;
