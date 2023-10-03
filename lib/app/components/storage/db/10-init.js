import sql from "#lib/sql";

export default sql`

CREATE TABLE storage_image (
    id serial8 PRIMARY KEY,
    hash text UNIQUE,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    links_count int8 NOT NULL DEFAULT 0,
    size int8 NOT NULL
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

CREATE FUNCTION storage_create_image (
    _hash text,
    _size int8
) RETURNS int8 AS $$
DECLARE
    _id int8;
BEGIN

    SELECT id FROM storage_image WHERE hash = _hash INTO _id;

    IF _id IS NULL THEN
        INSERT INTO storage_image
        (
            hash,
            size
        )
        VALUES (
            _hash,
            _size
        )
        RETURNING
            id
        INTO
            _id;
    END IF;

    RETURN _id;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION storage_create_file (
    _path text,
    _storage_image_id int8,
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

    IF NOT EXISTS SELECT FROM storage_file WHERE path = _path THEN
        INSERT INTO storage_file
        (
            path,
            storage_image_id,
            last_modified,
            content_type,
            cache_control,
            content_disposition,
            inactive_max_age,
            expires
        )
        VALUES (
            _path,
            _storage_image_id,
            _last_modified,
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
            telegram_bot_file
        SET
            path = _path,
            storage_image_id = _storage_image_id,
            last_modified = _last_modified,
            content_type = _content_type,
            cache_control = _cache_control,
            content_disposition = _content_disposition,
            inactive_max_age = _inactive_max_age,
            _expires = expires
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
        PERFORM pg_notify( 'storage/link/delete', json_build_object(
            'id', OLD.id::text
        )::text );
    END IF;

    SELECT hash, size::text FROM storage_image WHERE id = NEW.storage_image_id INTO file;

    PERFORM pg_notify( 'storage/link/update', json_build_object(
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

    PERFORM pg_notify( 'storage/link/delete', json_build_object(
        'id', OLD.id::text
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER storage_file_after_delete AFTER DELETE ON storage_file FOR EACH ROW EXECUTE FUNCTION storage_file_after_delete_trigger();

`;
