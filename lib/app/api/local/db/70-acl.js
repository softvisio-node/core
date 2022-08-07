import sql from "#lib/sql";

export default sql`

CREATE TABLE acl_type (
    id serial8 PRIMARY KEY,
    type text NOT NULL UNIQUE
);

CREATE TABLE acl_registry (
    id serial8 PRIMARY KEY,
    acl_type_id int2 NOT NULL REFERENCES acl_type ( id ) ON DELETE RESTRICT
);

CREATE TABLE acl (
    object_id int8 NOT NULL REFERENCES acl_registry ( id ) ON DELETE CASCADE,
    user_id int8 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    enabled bool NOT NULL DEFAULT TRUE,
    roles json,
    PRIMARY KEY ( object_id, user_id )
);

CREATE FUNCTION gen_acl_object_id ( _acl_type text ) RETURNS int8 AS $$
DECLARE
    _id int8;
BEGIN
    INSERT INTO acl_registry ( acl_type_id ) VALUES ( ( SELECT id FROM acl_type WHERE type = _acl_type ) ) RETURNING id INTO _id;

    RETURN _id;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION get_acl_object_users ( _object_id int8 ) RETURNS json AS $$
BEGIN

    RETURN ( SELECT json_agg( acl.user_id ) FROM acl WHERE acl.object_id = _object_id AND acl.enabled );
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION acl_object_after_delete_trigger () RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM acl_registry WHERE id = OLD.id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION acl_after_update_or_delete_trigger () RETURNS TRIGGER AS $$
BEGIN

    -- deleted
    IF ( TG_OP = 'DELETE' ) THEN
        PERFORM pg_notify( 'api/acl/delete', json_build_object(
            'user_id', OLD.user_id::text,
            'object_id', OLD.object_id::text
        )::text );

    -- updated
    ELSIF ( TG_OP = 'UPDATE' ) THEN
        PERFORM pg_notify( 'api/acl/update', json_build_object(
            'user_id', NEW.user_id::text,
            'object_id', NEW.object_id::text,
            'enabled', NEW.enabled,
            'roles', NEW.roles
        )::text );

    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER acl_after_update_or_delete AFTER UPDATE OR DELETE ON acl FOR EACH ROW EXECUTE FUNCTION acl_after_update_or_delete_trigger();

`;
