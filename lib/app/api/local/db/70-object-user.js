import sql from "#lib/sql";

export default sql`

CREATE TABLE object_user (
    user_id int8 NOT NULL REFERENCES "user" ( id ),
    object_id int8 NOT NULL,
    role text NOT NULL,
    UNIQUE ( user_id, object_id )
);

CREATE INDEX object_user_object_id ON object_user ( object_id );

CREATE FUNCTION gen_object_id( _type int4, _seq regclass ) RETURNS int8 AS $$
DECLARE
    _id int8;
BEGIN
    IF _type < 0 OR _type > 255 THEN
        RAISE EXCEPTION 'Object type is out of range';
    END IF;

    _id := nextval( _seq );

    IF _id <= 0 OR _id >= 36028797018963967 THEN
        RAISE EXCEPTION 'Object id for object type % is out of range', _type;
    END IF;

    RETURN ( SELECT overlay( _id::bit( 64 ) PLACING _type::int4::bit( 8 ) FROM 2 )::int8 );
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION object_user_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    -- deleted
    IF NEW.role IS NULL THEN
        PERFORM pg_notify( 'api/object-user/delete', json_build_object( 'user_id', OLD.user_id::text, 'object_id', OLD.object_id::text, 'role', OLD.role )::text );

    -- updated
    ELSE
        PERFORM pg_notify( 'api/object-user/update', json_build_object( 'user_id', NEW.user_id::text, 'object_id', NEW.object_id::text, 'role', NEW.role )::text );

    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER object_user_after_update AFTER UPDATE OR DELETE ON object_user FOR EACH ROW EXECUTE PROCEDURE object_user_after_update_trigger();

`;
