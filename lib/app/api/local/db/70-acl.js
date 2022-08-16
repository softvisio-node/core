import sql from "#lib/sql";

export default sql`

CREATE TABLE acl_type (
    id serial8 PRIMARY KEY,
    type text NOT NULL UNIQUE,
    enabled bool NOT NULL DEFAULT TRUE
);

CREATE TABLE acl_role (
    id serial8 PRIMARY KEY,
    acl_type_id int8 NOT NULL REFERENCES acl_type ( id ) ON DELETE CASCADE,
    enabled bool NOT NULL DEFAULT TRUE,
    role text NOT NULL,
    UNIQUE ( acl_type_id, role )
);

CREATE TABLE acl (
    id serial8 PRIMARY KEY,
    acl_type_id int8 NOT NULL REFERENCES acl_type ( id ) ON DELETE RESTRICT
);

CREATE TABLE acl_user (
    acl_id int8 NOT NULL REFERENCES acl ( id ) ON DELETE CASCADE,
    user_id int8 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    enabled bool NOT NULL DEFAULT TRUE,
    PRIMARY KEY ( acl_id, user_id )
);

CREATE TABLE acl_user_role (
    acl_id int8 NOT NULL,
    user_id int8 NOT NULL,
    acl_role_id int8 NOT NULL REFERENCES acl_role ( id ) ON DELETE CASCADE,
    PRIMARY KEY ( acl_id,user_id, acl_role_id ),
    FOREIGN KEY ( acl_id, user_id ) REFERENCES acl_user ( acl_id, user_id ) ON DELETE CASCADE
);

CREATE TABLE acl_object (
    id serial8 PRIMARY KEY,
    type text NOT NULL UNIQUE
);

CREATE TABLE acl_object_permissions (
    acl_object_id int8 NOT NULL REFERENCES acl_object ( id ) ON DELETE CASCADE,
    acl_role_id int8 NOT NULL REFERENCES acl_role ( id ) ON DELETE CASCADE,
    permissions jsonb NOT NULL DEFAULT '{}',
    PRIMARY KEY ( acl_object_id, acl_role_id )
);

CREATE TABLE acl_object_root_permissions (
    acl_object_id int8 PRIMARY KEY REFERENCES acl_object ( id ) ON DELETE CASCADE,
    permissions jsonb NOT NULL DEFAULT '{}'
);

CREATE FUNCTION create_acl ( _acl_type text ) RETURNS int8 AS $$
BEGIN

    RETURN create_acl( ( SELECT id FROM acl_type WHERE type = _acl_type ) );
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION create_acl ( _acl_type_id int8 ) RETURNS int8 AS $$
DECLARE
    _id int8;
BEGIN
    INSERT INTO acl ( acl_type_id ) VALUES ( _acl_type_id ) RETURNING id INTO _id;

    RETURN _id;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION get_acl_users ( _acl_id int8 ) RETURNS json AS $$
BEGIN
    RETURN ( SELECT json_agg( acl_user.user_id ) FROM acl_user WHERE acl_user.acl_id = _acl_id AND acl_user.enabled );
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION get_acl_permissions ( _acl_id int8, _user_id int8, _acl_object_type text ) RETURNS json STABLE AS $$
BEGIN

    RETURN get_acl_permissions( _acl_id, _user_id, ( SELECT id FROM acl_object WHERE type = _acl_object_type ) );

END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION get_acl_permissions ( _acl_id int8, _user_id int8, _acl_object_type_id int8 ) RETURNS json STABLE AS $$
DECLARE
    row record;
    res jsonb = '{}'::jsonb;
BEGIN

    -- root user
    IF _user_id = 1 THEN

        SELECT permissions FROM acl_object_root_permissions WHERE acl_object_id = _acl_object_type_id INTO res;

    -- non-root user
    ELSE
        FOR row IN

            with role AS (
                SELECT
                    acl_role_id AS id
                FROM
                    acl_user_role
                WHERE
                    acl_user_role.acl_id = _acl_id
                    AND acl_user_role.user_id = _user_id
            )
            SELECT
                acl_object_permissions.permissions
            FROM
                acl_object_permissions,
                role
            WHERE
                acl_object_permissions.acl_object_id = _acl_object_type_id
                AND acl_object_permissions.acl_role_id = role.id

        LOOP

            res := res || row.permissions;

        END LOOP;
    END IF;

    RETURN res;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION acl_after_delete_trigger () RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM acl WHERE id = OLD.id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION acl_user_after_update_or_delete_trigger () RETURNS TRIGGER AS $$
BEGIN

    -- deleted
    IF ( TG_OP = 'DELETE' ) THEN
        PERFORM pg_notify( 'api/acl/delete', json_build_object(
            'acl_id', OLD.acl_id::text,
            'user_id', OLD.user_id::text
        )::text );

    -- updated
    ELSIF ( TG_OP = 'UPDATE' ) THEN
        PERFORM pg_notify( 'api/acl/update', json_build_object(
            'acl_id', NEW.acl_id::text,
            'user_id', NEW.user_id::text,
            'enabled', NEW.enabled
        )::text );

    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER acl_user_after_update_or_delete AFTER UPDATE OR DELETE ON acl_user FOR EACH ROW EXECUTE FUNCTION acl_user_after_update_or_delete_trigger();

CREATE FUNCTION acl_user_role_after_insert_trigger() RETURNS TRIGGER AS $$
DECLARE
    row record;
BEGIN

    FOR row IN SELECT acl_id, user_id FROM new_table GROUP BY acl_id, user_id LOOP

        PERFORM pg_notify( 'api/acl/delete', json_build_object(
            'acl_id', row.acl_id::text,
            'user_id', row.user_id::text
        )::text );

    END LOOP;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER acl_user_role_after_insert AFTER INSERT ON acl_user_role REFERENCING NEW TABLE AS new_table FOR EACH STATEMENT EXECUTE FUNCTION acl_user_role_after_insert_trigger();

CREATE FUNCTION acl_user_role_after_delete_trigger() RETURNS TRIGGER AS $$
DECLARE
    row record;
BEGIN

    FOR row IN SELECT acl_id, user_id FROM old_table GROUP BY acl_id, user_id LOOP

        -- acl user was not removed
        IF EXISTS ( SELECT FROM acl_user WHERE acl_user.acl_id = row.acl_id AND acl_user.user_id = row.user_id ) THEN

            PERFORM pg_notify( 'api/acl/delete', json_build_object(
                'acl_id', row.acl_id::text,
                'user_id', row.user_id::text
            )::text );

        END IF;

    END LOOP;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER acl_user_role_after_delete AFTER DELETE ON acl_user_role REFERENCING OLD TABLE AS old_table FOR EACH STATEMENT EXECUTE FUNCTION acl_user_role_after_delete_trigger();

`;
