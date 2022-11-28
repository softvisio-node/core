import sql from "#lib/sql";

export default sql`

CREATE TABLE acl_type (
    id serial8 PRIMARY KEY,
    type text NOT NULL UNIQUE,
    enabled bool NOT NULL DEFAULT TRUE
);

CREATE TABLE acl_scope (
    id serial8 PRIMARY KEY,
    acl_type_id int8 NOT NULL REFERENCES acl_type ( id ) ON DELETE CASCADE,
    scope text NOT NULL,
    enabled bool NOT NULL DEFAULT TRUE,
    UNIQUE ( acl_type_id, scope )
);

CREATE TABLE acl_permission (
    acl_scope_id int8 NOT NULL REFERENCES acl_scope ( id ) ON DELETE CASCADE,
    permission text NOT NULL,
    PRIMARY KEY ( acl_scope_id, permission )
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

CREATE TABLE acl_user_scope (
    acl_id int8 NOT NULL,
    user_id int8 NOT NULL,
    acl_scope_id int8 NOT NULL REFERENCES acl_scope ( id ) ON DELETE CASCADE,
    PRIMARY KEY ( acl_id,user_id, acl_scope_id ),
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

CREATE FUNCTION acl_permissions ( _acl_id int8, _user_id int8 ) RETURNS json STABLE AS $$
BEGIN

    RETURN ( SELECT
        json_agg( DISTINCT acl_permission.permission )
    FROM
        acl,
        acl_type,
        acl_user,
        acl_scope
        LEFT JOIN acl_user_scope ON ( acl_user.acl_id = acl_user_scope.acl_id AND acl_user.user_id = acl_user_scope.user_id )
        LEFT JOIN acl_permission ON ( acl_scope.id = acl_permission.acl_scope_id )
    WHERE
        acl.id = _acl_id AND acl.acl_type_id = acl_type.id AND acl_type.enabled
        AND acl.id = acl_user.acl_id AND acl_user.user_id = _user_id AND acl_user.enabled
        AND acl_user_scope.acl_scope_id = acl_scope.id AND acl_scope.enabled
    );
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

CREATE FUNCTION acl_user_scope_after_insert_trigger() RETURNS TRIGGER AS $$
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

CREATE TRIGGER acl_user_scope_after_insert AFTER INSERT ON acl_user_scope REFERENCING NEW TABLE AS new_table FOR EACH STATEMENT EXECUTE FUNCTION acl_user_scope_after_insert_trigger();

CREATE FUNCTION acl_user_scope_after_delete_trigger() RETURNS TRIGGER AS $$
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

CREATE TRIGGER acl_user_scope_after_delete AFTER DELETE ON acl_user_scope REFERENCING OLD TABLE AS old_table FOR EACH STATEMENT EXECUTE FUNCTION acl_user_scope_after_delete_trigger();

`;
