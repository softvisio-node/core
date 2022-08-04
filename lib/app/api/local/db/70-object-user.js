import sql from "#lib/sql";

export default sql`

CREATE TABLE object_type (
    id serial8 PRIMARY KEY,
    type text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS objects_registry (
    id serial8 PRIMARY KEY,
    object_type_id int2 NOT NULL REFERENCES object_type ( id ) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS object_user (
    object_id int8 NOT NULL REFERENCES objects_registry ( id ) ON DELETE CASCADE,
    user_id int8 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    role text NOT NULL,
    PRIMARY KEY ( object_id, user_id )
);

CREATE OR REPLACE FUNCTION gen_object_id( _type text ) RETURNS int8 AS $$
BEGIN
    RETURN ( INSERT INTO objects_registry ( object_type_id ) VALUES ( ( SELECT id FROM object_type WHERE type = _type ) ) RETURNING id );
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION object_after_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM objects_registry WHERE id = OLD.id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION object_user_after_update_or_delete_trigger() RETURNS TRIGGER AS $$
BEGIN

    -- deleted
    IF ( TG_OP = 'DELETE' ) THEN
        PERFORM pg_notify( 'api/object-user/delete', json_build_object(
            'user_id', OLD.user_id::text,
            'object_id', OLD.object_id::text,
            'role', OLD.role
        )::text );

    -- updated
    ELSIF ( TG_OP = 'UPDATE' ) THEN
        PERFORM pg_notify( 'api/object-user/update', json_build_object(
            'user_id', NEW.user_id::text,
            'object_id', NEW.object_id::text,
            'role', NEW.role
        )::text );

    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER object_user_after_update_or_delete AFTER UPDATE OR DELETE ON object_user FOR EACH ROW EXECUTE FUNCTION object_user_after_update_or_delete_trigger();

`;
