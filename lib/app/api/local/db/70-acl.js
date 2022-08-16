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

CREATE TABLE acl_type_permissions (
    acl_type_id int8 NOT NULL REFERENCES acl_type ( id ) ON DELETE CASCADE,
    acl_type_role_id int8 NOT NULL REFERENCES acl_type_role ( id ) ON DELETE CASCADE,
    permissions jsonb NOT NULL DEFAULT '{}',
    PRIMARY KEY ( acl_type_id, acl_type_role_id )
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

CREATE FUNCTION create_acl ( _acl_type text ) RETURNS int8 AS $$
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

--- XXX
CREATE or replace FUNCTION get_acl_permissions ( _acl_id int8, _user_id int8, _acl_object_type text ) RETURNS json STABLE AS $$
DECLARE
    row record;
    res jsonb = '{}'::jsonb;
BEGIN

    FOR row IN
        with role AS (
            SELECT
                acl_type_role.id
            FROM
                acl,
                acl_role,
                acl_type_role
            WHERE
                acl.object_id = _acl_id AND acl.user_id = _user_id
                AND acl_role.acl_id = acl.id
                AND acl_role.acl_type_role_id = acl_type_role.id
        )
        SELECT
            acl_type_permissions.permissions
        FROM
            acl_type_permissions,
            role,
            acl_type
        WHERE
            acl_type_permissions.acl_type_role_id = role.id
            AND acl_type_permissions.acl_type_id = acl_type.id
            AND acl_type.type = _acl_object_type
    LOOP
        res := res || row.permissions;
    END LOOP;

    RETURN res;
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
            'object_id', OLD.object_id::text,
            'user_id', OLD.user_id::text
        )::text );

    -- updated
    ELSIF ( TG_OP = 'UPDATE' ) THEN
        PERFORM pg_notify( 'api/acl/update', json_build_object(
            'object_id', NEW.object_id::text,
            'user_id', NEW.user_id::text,
            'enabled', NEW.enabled
        )::text );

    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER acl_after_update_or_delete AFTER UPDATE OR DELETE ON acl FOR EACH ROW EXECUTE FUNCTION acl_after_update_or_delete_trigger();

CREATE FUNCTION acl_role_after_insert_trigger() RETURNS TRIGGER AS $$
DECLARE
    row record;
BEGIN

    FOR row IN SELECT acl_id FROM new_table GROUP BY acl_id LOOP

        PERFORM pg_notify( 'api/acl/delete', json_build_object(
            'object_id', ( SELECT object_id FROM acl WHERE id = row.acl_id )::text,
            'user_id', ( SELECT user_id FROM acl WHERE id = row.acl_id )::text
        )::text );

    END LOOP;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER acl_role_after_insert AFTER INSERT ON acl_role REFERENCING NEW TABLE AS new_table FOR EACH STATEMENT EXECUTE FUNCTION acl_role_after_insert_trigger();

CREATE FUNCTION acl_role_after_delete_trigger() RETURNS TRIGGER AS $$
DECLARE
    row record;
BEGIN

    IF NOT EXISTS ( SELECT FROM acl, old_table WHERE acl.id = old_table.acl_id ) THEN
        RETURN NULL;
    END IF;

    FOR row IN SELECT acl_id FROM old_table GROUP BY acl_id LOOP

        PERFORM pg_notify( 'api/acl/delete', json_build_object(
            'object_id', ( SELECT object_id FROM acl WHERE id = row.acl_id )::text,
            'user_id', ( SELECT user_id FROM acl WHERE id = row.acl_id )::text
        )::text );

    END LOOP;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER acl_role_after_delete AFTER DELETE ON acl_role REFERENCING OLD TABLE AS old_table FOR EACH STATEMENT EXECUTE FUNCTION acl_role_after_delete_trigger();

`;
