import sql from "#lib/sql";

export default sql`

CREATE TABLE IF NOT EXISTS objects_registry (
    id int8 PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS object_user (
    object_id int8 NOT NULL REFERENCES objects_registry ( id ) ON DELETE CASCADE,
    user_id int8 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    role text NOT NULL,
    PRIMARY KEY ( object_id, user_id )
);

CREATE SEQUENCE object_id_seq AS int8 MAXVALUE 36028797018963967;

CREATE OR REPLACE FUNCTION gen_object_id( _type int4 ) RETURNS int8 AS $$
DECLARE
    _id int8;
BEGIN
    IF _type < 0 OR _type > 255 THEN
        RAISE EXCEPTION 'Object type is out of range';
    END IF;

     _id := nextval( 'object_id_seq' );

    IF _id <= 0 OR _id >= 36028797018963967 THEN
        RAISE EXCEPTION 'Object id for object type % is out of range', _type;
    END IF;

    RETURN ( SELECT overlay( _id::bit( 64 ) PLACING _type::int4::bit( 8 ) FROM 2 )::int8 );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION object_before_insert_trigger() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO objects_registry ( id ) VALUES ( NEW.id );

    RETURN NEW;
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
