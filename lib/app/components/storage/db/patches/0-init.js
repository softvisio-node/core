import sql from "#lib/sql";

export default sql`

DROP FUNCTION storage_create_file;
DROP FUNCTION storage_create_image;
DROP TABLE storage_file;
DROP TABLE storage_image;
DROP FUNCTION storage_file_after_update_trigger;
DROP FUNCTION storage_file_after_delete_trigger;

CREATE TABLE storage_image (
    path text PRIMARY KEY,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    links_count int8 NOT NULL DEFAULT 0
);

CREATE TABLE storage_file (
    id serial8 PRIMARY KEY,
    path text NOT NULL UNIQUE REFERENCES storage_image ( path ) ON DELETE RESTRICT,
    hash text NOT NULL,
    size int8 NOT NULL,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_modified timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    content_type text,
    cache_control text,
    content_disposition text,
    inactive_max_age text,
    expires timestamptz
);

CREATE INDEX storage_file_expires_idx ON storage_file ( expires );

CREATE FUNCTION storage_file_after_insert_trigger () RETURNS TRIGGER AS $$
BEGIN

    UPDATE storage_image SET links_count = links_count + 1 WHERE path = NEW.path;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER storage_file_after_insert AFTER INSERT ON storage_file FOR EACH ROW EXECUTE FUNCTION storage_file_after_insert_trigger();

CREATE FUNCTION storage_file_after_update_trigger () RETURNS TRIGGER AS $$
DECLARE
    file record;
BEGIN

    PERFORM pg_notify( 'storage/file/update', json_build_object(
        'id', NEW.id::text,
        'path', NEW.path,
        'last_modified', NEW.last_modified,
        'content_type', NEW.content_type,
        'cache_control', NEW.cache_control,
        'content_disposition', NEW.content_disposition,
        'content_length', NEW.size,
        'inactive_max_age', NEW.inactive_max_age,
        'expires', NEW.expires,
        'hash', NEW.hash
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER storage_file_after_update AFTER UPDATE ON storage_file FOR EACH ROW EXECUTE FUNCTION storage_file_after_update_trigger();

CREATE FUNCTION storage_file_after_delete_trigger () RETURNS TRIGGER AS $$
BEGIN

    UPDATE storage_image SET links_count = links_count - 1 WHERE path = OLD.path;

    PERFORM pg_notify( 'storage/file/delete', json_build_object(
        'id', OLD.id::text
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER storage_file_after_delete AFTER DELETE ON storage_file FOR EACH ROW EXECUTE FUNCTION storage_file_after_delete_trigger();

`;
