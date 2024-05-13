import sql from "#lib/sql";
import constants from "#lib/app/constants";

export default sql`

CREATE EXTENSION IF NOT EXISTS softvisio_types;

CREATE SEQUENCE acl_type_id_seq AS int8 MAXVALUE ${ Number.MAX_SAFE_INTEGER };

CREATE TABLE acl_type (
    id int53 PRIMARY KEY DEFAULT nextval( 'acl_type_id_seq' ),
    type text NOT NULL UNIQUE,
    enabled bool NOT NULL DEFAULT TRUE
);

ALTER SEQUENCE acl_type_id_seq OWNED BY acl_type.id;

CREATE SEQUENCE acl_role_id_seq AS int8 MAXVALUE ${ Number.MAX_SAFE_INTEGER };

CREATE TABLE acl_role (
    id int53 PRIMARY KEY DEFAULT nextval( 'acl_role_id_seq' ),
    acl_type_id int53 NOT NULL REFERENCES acl_type ( id ) ON DELETE CASCADE,
    role text NOT NULL,
    enabled bool NOT NULL DEFAULT TRUE,
    UNIQUE ( acl_type_id, role )
);

ALTER SEQUENCE acl_role_id_seq OWNED BY acl_role.id;

CREATE TABLE acl_permission (
    acl_role_id int53 NOT NULL REFERENCES acl_role ( id ) ON DELETE CASCADE,
    permission text NOT NULL,
    PRIMARY KEY ( acl_role_id, permission )
);

CREATE SEQUENCE acl_id_seq AS int8 MAXVALUE ${ Number.MAX_SAFE_INTEGER };

CREATE TABLE acl (
    id int53 PRIMARY KEY DEFAULT nextval( 'acl_id_seq' ),
    acl_type_id int53 NOT NULL REFERENCES acl_type ( id ) ON DELETE RESTRICT
);

ALTER SEQUENCE acl_id_seq OWNED BY acl.id;

CREATE TABLE acl_user (
    acl_id int53 NOT NULL REFERENCES acl ( id ) ON DELETE CASCADE,
    user_id int53 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    enabled bool NOT NULL DEFAULT TRUE,
    PRIMARY KEY ( acl_id, user_id )
);

CREATE TABLE acl_user_role (
    acl_id int53 NOT NULL,
    user_id int53 NOT NULL,
    acl_role_id int53 NOT NULL REFERENCES acl_role ( id ) ON DELETE CASCADE,
    PRIMARY KEY ( acl_id,user_id, acl_role_id ),
    FOREIGN KEY ( acl_id, user_id ) REFERENCES acl_user ( acl_id, user_id ) ON DELETE CASCADE
);

CREATE FUNCTION create_acl ( _acl_type text ) RETURNS int53 AS $$
BEGIN

    RETURN create_acl( ( SELECT id FROM acl_type WHERE type = _acl_type ) );
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION create_acl ( _acl_type_id int53 ) RETURNS int53 AS $$
DECLARE
    _id int53;
BEGIN
    INSERT INTO acl ( acl_type_id ) VALUES ( _acl_type_id ) RETURNING id INTO _id;

    RETURN _id;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION get_acl_users ( _acl_id int53 ) RETURNS json AS $$
BEGIN
    RETURN ( SELECT json_agg( acl_user.user_id ) FROM acl_user WHERE acl_user.acl_id = _acl_id AND acl_user.enabled );
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION acl_user_roles ( _acl_id int53, _user_id int53 ) RETURNS json STABLE AS $$
BEGIN

    -- root user
    IF _user_id = ${ constants.rootUserId } THEN
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

CREATE FUNCTION acl_user_permissions ( _acl_id int53, _user_id int53 ) RETURNS json STABLE AS $$
BEGIN

    RETURN (
        SELECT
            json_agg( permission )
        FROM
            _get_acl_user_permissions( _acl_id, _user_id )
    );

END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION acl_has_user ( _acl_id int53, _user_id int53 ) RETURNS bool STABLE AS $$
BEGIN
    IF _user_id = ${ constants.rootUserId } THEN
        RETURN EXISTS ( SELECT FROM acl WHERE id = _acl_id );
    ELSE
        RETURN EXISTS ( SELECT FROM acl_user WHERE acl_id = _acl_id AND user_id = _user_id AND enabled );
    END IF;

END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION acl_user_editable ( _acl_id int53, _acl_user_id int53, _parent_user_id int53 ) RETURNS bool STABLE AS $$
BEGIN

    IF _parent_user_id = ${ constants.rootUserId } THEN
        RETURN TRUE;
    ELSIF _acl_user_id = _parent_user_id THEN
        RETURN FALSE;
    ELSE
        RETURN NOT EXISTS (
            WITH acl_user_permissions AS (
                SELECT permission FROM _get_acl_user_permissions( _acl_id, _acl_user_id )
            )
            SELECT FROM
                acl_user_permissions
            WHERE
                permission NOT IN ( SELECT permission FROM _get_acl_user_permissions( _acl_id, _parent_user_id ) )
        );
    END IF;

END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION _get_acl_user_permissions ( _acl_id int53, _user_id int53 ) RETURNS TABLE ( permission text ) STABLE AS $$
BEGIN

    -- root user
    IF _user_id = ${ constants.rootUserId } THEN
        RETURN QUERY
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
                acl_permission.permission ASC;

    -- non-root user
    ELSE
        RETURN QUERY
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
                acl_permission.permission ASC;
    END IF;

END;
$$ LANGUAGE plpgsql;

-- acl/update, acl/delete
CREATE FUNCTION acl_user_after_update_or_delete_trigger () RETURNS TRIGGER AS $$
BEGIN

    -- deleted
    IF ( TG_OP = 'DELETE' ) THEN
        PERFORM pg_notify( 'acl/delete', json_build_object(
            'acl_id', OLD.acl_id,
            'user_id', OLD.user_id
        )::text );

    -- updated
    ELSIF ( TG_OP = 'UPDATE' ) THEN
        PERFORM pg_notify( 'acl/update', json_build_object(
            'acl_id', NEW.acl_id,
            'user_id', NEW.user_id,
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
            'acl_id', row.acl_id,
            'user_id', row.user_id
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
                'acl_id', row.acl_id,
                'user_id', row.user_id
            )::text );

        END IF;

    END LOOP;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER acl_user_role_after_delete AFTER DELETE ON acl_user_role REFERENCING OLD TABLE AS old_table FOR EACH STATEMENT EXECUTE FUNCTION acl_user_role_after_delete_trigger();

`;
