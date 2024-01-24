import sql from "#lib/sql";

export default sql`

CREATE TABLE storage_image (
    id serial8 PRIMARY KEY,
    path text NOT NULL UNIQUE,
    hash text NOT NULL,
    size int8 NOT NULL,
    encrypted bool NOT NULL,
    links_count int8 NOT NULL DEFAULT 0
);

CREATE TABLE storage_file (
    id serial8 PRIMARY KEY,
    storage_image_id int8 NOT NULL REFERENCES storage_image ( id ) ON DELETE RESTRICT,
    path text NOT NULL UNIQUE,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_modified timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    content_type text,
    cache_control text,
    content_disposition text,
    inactive_max_age text,
    expires timestamptz
);

CREATE INDEX storage_file_expires_idx ON storage_file ( expires );

CREATE FUNCTION storage_create_image (
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

CREATE FUNCTION storage_create_file (
    _storage_image_id int8,
    _path text,
    _last_modified timestamptz,
    _content_type text,
    _cache_control text,
    _content_disposition text,
    _inactive_max_age text,
    _expires timestamptz
) RETURNS int8 AS $$
DECLARE
    _id int8;
BEGIN

    IF NOT EXISTS ( SELECT FROM storage_file WHERE path = _path ) THEN
        INSERT INTO storage_file
        (
            storage_image_id,
            path,
            last_modified,
            content_type,
            cache_control,
            content_disposition,
            inactive_max_age,
            expires
        )
        VALUES (
            _storage_image_id,
            _path,
            coalesce( _last_modified, CURRENT_TIMESTAMP ),
            _content_type,
            _cache_control,
            _content_disposition,
            _inactive_max_age,
            _expires
        )
        RETURNING
            id
        INTO
            _id;
    ELSE
        UPDATE
            storage_file
        SET
            storage_image_id = _storage_image_id,
            last_modified = coalesce( _last_modified, CURRENT_TIMESTAMP ),
            content_type = _content_type,
            cache_control = _cache_control,
            content_disposition = _content_disposition,
            inactive_max_age = _inactive_max_age,
            expires = _expires
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

CREATE FUNCTION storage_file_after_insert_trigger () RETURNS TRIGGER AS $$
BEGIN

    UPDATE storage_image SET links_count = links_count + 1 WHERE id = NEW.storage_image_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER storage_file_after_insert AFTER INSERT ON storage_file FOR EACH ROW EXECUTE FUNCTION storage_file_after_insert_trigger();

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

CREATE TRIGGER storage_file_after_update AFTER UPDATE ON storage_file FOR EACH ROW EXECUTE FUNCTION storage_file_after_update_trigger();

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
