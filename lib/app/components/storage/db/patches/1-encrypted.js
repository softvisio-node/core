import sql from "#lib/sql";

export default sql`

ALTER TABLE storage_image ADD COLUMN encrypted bool;

UPDATE storage_image SET encrypted = FALSE;

ALTER TABLE storage_image ALTER COLUMN encrypted SET NOT NULL;

CREATE OR REPLACE FUNCTION storage_create_image (
    _path text,
    _hash text,
    _size int8,
    _encrypted bool
) RETURNS int8 AS $$
DECLARE
    _id int8;
BEGIN

    IF NOT EXISTS ( SELECT FROM storage_image WHERE path = _path ) THEN
        INSERT INTO storage_image
        (
            path,
            hash,
            size,
            encrypted
        )
        VALUES (
            _path,
            _hash,
            _size,
            _encrypted
        )
        RETURNING
            id
        INTO
            _id;
    ELSE
        UPDATE
            storage_image
        SET
            hash = _hash,
            size = _size,
            encrypted = _encrypted
        WHERE
            path = _path
        RETURNING
            id
        INTO
            _id;
    END IF;

    RETURN _id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION storage_file_after_update_trigger () RETURNS TRIGGER AS $$
DECLARE
    image record;
BEGIN

    IF OLD.storage_image_id != NEW.storage_image_id THEN
        UPDATE storage_image SET links_count = links_count - 1 WHERE id = OLD.storage_image_id;

        UPDATE storage_image SET links_count = links_count + 1 WHERE id = NEW.storage_image_id;
    END IF;

    -- renamed
    IF OLD.path != NEW.path THEN
        PERFORM pg_notify( 'storage/file/delete', json_build_object(
            'id', NEW.id::text
        )::text );

    -- updated
    ELSE
        SELECT path, hash, size::text, encrypted FROM storage_image WHERE id = NEW.storage_image_id INTO image;

        PERFORM pg_notify( 'storage/file/update', json_build_object(
            'id', NEW.id::text,
            'path', NEW.path,
            'storage_image_id', NEW.storage_image_id::text,
            'last_modified', NEW.last_modified,
            'content_type', NEW.content_type,
            'cache_control', NEW.cache_control,
            'content_disposition', NEW.content_disposition,
            'inactive_max_age', NEW.inactive_max_age,
            'expires', NEW.expires,

            'image_path', image.path,
            'hash', image.hash,
            'size', image.size,
            'encrypted', image.encrypted
        )::text );
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

`;
