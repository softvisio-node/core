import sql from "#lib/sql";

export default sql`

CREATE TABLE storage_image (
    id serial8 PRIMARY KEY,
    path text NOY NULL UNIQUE,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    hash text NOT NULL,
    size int8 NOT NULL,
    links_count int8 NOT NULL DEFAULT 0
);

CREATE TABLE storage_file (
    id serial8 PRIMARY KEY,
    path text NOT NULL UNIQUE,
    storage_image_id int8 NOT NULL REFERENCES storage_image ( id ) ON DELETE RESTRICT,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_modified timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    content_type TEXT,
    cache_control TEXT,
    content_disposition TEXT,
    inactive_max_age text,
    expires timestamptz
);

CREATE INDEX storage_file_expires_idx ON storage_file ( expires );

CREATE FUNCTION storage_file_after_insert_trigger () RETURNS TRIGGER AS $$
BEGIN

    UPDATE storage_image SET links_count = links_count + 1 WHERE id = NEW.storage_image_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER storage_file_after_insert AFTER INSERT ON storage_file FOR EACH ROW EXECUTE FUNCTION storage_file_after_insert_trigger();

-- XXX
CREATE FUNCTION storage_file_after_update_trigger () RETURNS TRIGGER AS $$
DECLARE
    file record;
BEGIN

    -- storage_image_id updated
    IF OLD.storage_image_id != NEW.storage_image_id THEN
        UPDATE storage_image SET links_count = links_count - 1 WHERE id = OLD.storage_image_id;

        UPDATE storage_image SET links_count = links_count + 1 WHERE id = NEW.storage_image_id;
    END IF;

    -- path updated
    IF OLD.path != NEW.path THEN
        PERFORM pg_notify( 'storage/file/delete', json_build_object(
            'id', OLD.id::text
        )::text );
    END IF;

    SELECT hash, size::text FROM storage_image WHERE id = NEW.storage_image_id INTO file;

    PERFORM pg_notify( 'storage/file/update', json_build_object(
        'id', NEW.id::text,
        'path', NEW.path,
        'storage_image_id', NEW.storage_image_id::text,
        'last_modified', NEW.last_modified,
        'content_type', NEW.content_type,
        'cache_control', NEW.cache_control,
        'content_disposition', NEW.content_disposition,
        'content_length', file.size,
        'inactive_max_age', NEW.inactive_max_age,
        'expires', NEW.expires,
        'hash', file.hash
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER storage_file_after_update AFTER UPDATE OF storage_image_id ON storage_file FOR EACH ROW EXECUTE FUNCTION storage_file_after_update_trigger();

CREATE FUNCTION storage_file_after_delete_trigger () RETURNS TRIGGER AS $$
BEGIN

    UPDATE storage_image SET links_count = links_count - 1 WHERE id = OLD.storage_image_id;

    PERFORM pg_notify( 'storage/file/delete', json_build_object(
        'id', OLD.id::text
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER storage_file_after_delete AFTER DELETE ON storage_file FOR EACH ROW EXECUTE FUNCTION storage_file_after_delete_trigger();

`;
