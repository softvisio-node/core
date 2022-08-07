import sql from "#lib/sql";

export default sql`

CREATE TABLE acl_type (
    id serial8 PRIMARY KEY,
    type text NOT NULL UNIQUE,
    enabled bool NOT NULL DEFAULT TRUE
);

CREATE TABLE acl_type_role (
    id serial8 PRIMARY KEY,
    acl_type_id int8 NOT NULL REFERENCES acl_type ( id ) ON DELETE CASCADE,
    enabled bool NOT NULL DEFAULT TRUE,
    role text NOT NULL,
    UNIQUE ( acl_type_id, role )
);

CREATE TABLE acl_object (
    id serial8 PRIMARY KEY,
    acl_type_id int8 NOT NULL REFERENCES acl_type ( id ) ON DELETE RESTRICT
);

CREATE TABLE acl (
    id serial8 PRIMARY KEY,
    object_id int8 NOT NULL REFERENCES acl_object ( id ) ON DELETE CASCADE,
    user_id int8 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    enabled bool NOT NULL DEFAULT TRUE,
    UNIQUE ( object_id, user_id )
);

CREATE TABLE acl_role (
    id serial8 PRIMARY KEY,
    acl_id int8 NOT NULL REFERENCES acl ( id ) ON DELETE CASCADE,
    acl_type_role_id int8 NOT NULL REFERENCES acl_type_role ( id ) ON DELETE CASCADE,
    UNIQUE ( acl_id, acl_type_role_id )
);

CREATE FUNCTION gen_acl_id ( _acl_type text ) RETURNS int8 AS $$
DECLARE
    _id int8;
BEGIN
    INSERT INTO acl_object ( acl_type_id ) VALUES ( ( SELECT id FROM acl_type WHERE type = _acl_type ) ) RETURNING id INTO _id;

    RETURN _id;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION get_acl_users ( _object_id int8 ) RETURNS json AS $$
BEGIN

    RETURN ( SELECT json_agg( acl.user_id ) FROM acl WHERE acl.object_id = _object_id AND acl.enabled );
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION acl_after_delete_trigger () RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM acl_object WHERE id = OLD.id;

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
