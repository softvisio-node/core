import sql from "#lib/sql";

export default sql`

CREATE TABLE object_role (
    user_id int8 NOT NULL REFERENCES "user" ( id ),
    object_id int8 NOT NULL,
    role text NOT NULL,
    UNIQUE ( user_id, object_id, role )
);

CREATE INDEX object_role_object_id ON object_role ( object_id );

CREATE SEQUENCE object_id_seq AS int8 NO CYCLE;

CREATE FUNCTION object_role_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    -- deleted
    IF NEW.role IS NULL THEN
        PERFORM pg_notify( 'api/object-role/delete', json_build_object( 'user_id', OLD.user_id::text, 'object_id', OLD.object_id::text, 'role', OLD.role )::text );

    -- updated
    ELSE
        PERFORM pg_notify( 'api/object-role/update', json_build_object( 'user_id', NEW.user_id::text, 'object_id', NEW.object_id::text, 'role', NEW.role )::text );

    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER object_role_after_update AFTER UPDATE OR DELETE ON object_role FOR EACH ROW EXECUTE PROCEDURE object_role_after_update_trigger();

`;
