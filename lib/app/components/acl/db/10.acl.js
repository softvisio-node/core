import sql from "#lib/sql";
import constants from "#lib/app/constants";

export default sql`

CREATE TABLE acl_type (
    id serial8 PRIMARY KEY,
    type text NOT NULL UNIQUE,
    enabled bool NOT NULL DEFAULT TRUE
);

CREATE TABLE acl_role (
    id serial8 PRIMARY KEY,
    acl_type_id int8 NOT NULL REFERENCES acl_type ( id ) ON DELETE CASCADE,
    role text NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    enabled bool NOT NULL DEFAULT TRUE,
    UNIQUE ( acl_type_id, role )
);

CREATE TABLE acl_permission (
    acl_role_id int8 NOT NULL REFERENCES acl_role ( id ) ON DELETE CASCADE,
    permission text NOT NULL,
    PRIMARY KEY ( acl_role_id, permission )
);

CREATE TABLE acl (
    id serial8 PRIMARY KEY,
    acl_type_id int8 NOT NULL REFERENCES acl_type ( id ) ON DELETE RESTRICT
);

CREATE TABLE acl_user (
    acl_id int8 NOT NULL REFERENCES acl ( id ) ON DELETE CASCADE,
    user_id int8 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

CREATE FUNCTION acl_user_roles ( _acl_id int8, _user_id int8 ) RETURNS json STABLE AS $$
BEGIN

    -- root user
    IF _user_id = ${constants.rootUserId} THEN
        RETURN (
            SELECT
                json_agg( role )
            FROM (
                SELECT
                    acl_role.role
                FROM
                    acl_role,
                    acl_type,
                    acl
                WHERE
                    acl_role.enabled
                    AND acl_role.acl_type_id = acl_type.id
                    AND acl_type.id = acl.acl_type_id
                    AND acl.id = _acl_id
                ORDER BY
                    acl_role.role ASC
            ) AS roles
        );

    -- non-root user
    ELSE
        RETURN (
            SELECT
                json_agg( role )
            FROM (
                SELECT
                    acl_role.role
                FROM
                    acl_user_role,
                    acl_role
                WHERE
                    acl_user_role.acl_id = _acl_id
                    AND acl_user_role.user_id = _user_id
                    AND acl_user_role.acl_role_id = acl_role.id
                    AND acl_role.enabled
                ORDER BY
                    acl_role.role ASC
            ) AS roles
        );
    END IF;

END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION acl_user_permissions ( _acl_id int8, _user_id int8 ) RETURNS json STABLE AS $$
BEGIN

    -- root user
    IF _user_id = ${constants.rootUserId} THEN
        RETURN (
            SELECT
                json_agg( permission )
            FROM (
                SELECT DISTINCT
                    acl_permission.permission
                FROM
                    acl_permission,
                    acl_role,
                    acl_type,
                    acl
                WHERE
                    acl_permission.acl_role_id = acl_role.id AND acl_role.enabled
                    AND acl_role.acl_type_id = acl_type.id
                    AND acl_type.id = acl.acl_type_id
                    AND acl.id = _acl_id
                ORDER BY
                    acl_permission.permission ASC
            ) AS permissions
        );

    -- non-root user
    ELSE
        RETURN (
            SELECT
                json_agg( permission )
            FROM (
                SELECT DISTINCT
                    acl_permission.permission
                FROM
                    acl_permission,
                    acl_role,
                    acl_type,
                    acl_user_role,
                    acl_user
                WHERE
                    acl_permission.acl_role_id = acl_role.id AND acl_role.enabled
                    AND acl_type.id = acl_role.acl_type_id AND acl_type.enabled
                    AND acl_user_role.acl_role_id = acl_role.id
                    AND acl_user.acl_id = acl_user_role.acl_id AND acl_user.user_id = acl_user_role.user_id
                    AND acl_user.acl_id = _acl_id AND acl_user.user_id = _user_id AND acl_user.enabled
                ORDER BY
                    acl_permission.permission ASC
            ) AS permissions
        );
    END IF;

END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION acl_after_delete_trigger () RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM acl WHERE id = OLD.id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- acl/type/update
CREATE FUNCTION acl_type_after_update_trigger () RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'acl/type/update', null );

    RETURN NULL;

END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER acl_type_after_insert_or_update_or_delete AFTER INSERT OR UPDATE OR DELETE ON acl_type FOR EACH ROW EXECUTE FUNCTION acl_type_after_update_trigger();

CREATE TRIGGER acl_role_after_insert_or_update_or_delete AFTER INSERT OR UPDATE OR DELETE ON acl_role FOR EACH ROW EXECUTE FUNCTION acl_type_after_update_trigger();

CREATE TRIGGER acl_permission_after_insert_or_update_or_delete AFTER INSERT OR UPDATE OR DELETE ON acl_permission FOR EACH ROW EXECUTE FUNCTION acl_type_after_update_trigger();

-- acl/update, acl/delete
CREATE FUNCTION acl_user_after_update_or_delete_trigger () RETURNS TRIGGER AS $$
BEGIN

    -- deleted
    IF ( TG_OP = 'DELETE' ) THEN
        PERFORM pg_notify( 'acl/delete', json_build_object(
            'acl_id', OLD.acl_id::text,
            'user_id', OLD.user_id::text
        )::text );

    -- updated
    ELSIF ( TG_OP = 'UPDATE' ) THEN
        PERFORM pg_notify( 'acl/update', json_build_object(
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

        PERFORM pg_notify( 'acl/delete', json_build_object(
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

            PERFORM pg_notify( 'acl/delete', json_build_object(
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
