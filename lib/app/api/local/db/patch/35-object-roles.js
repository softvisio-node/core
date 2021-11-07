import sql from "#lib/sql";

export default sql`

CREATE OR REPLACE FUNCTION gen_object_id( _type int4, _seq regclass ) RETURNS int8 AS $$
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

DROP SEQUENCE IF EXISTS object_id_seq;

`;
