import sql from "#lib/sql";

export default sql`

CREATE FUNCTION object_permissions_invalidate_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/invalidate-object-permissions', json_build_object( 'object_id', OLD.object_id::text, 'user_id', OLD.user_id::text )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER object_permissions_permissions_after_update_trigger AFTER UPDATE OF permissions ON object_permissions FOR EACH ROW EXECUTE PROCEDURE object_permissions_invalidate_trigger();

CREATE TRIGGER object_permissions_enabled_after_update_trigger AFTER UPDATE OF enabled ON object_permissions FOR EACH ROW WHEN ( NEW.enabled = FALSE ) EXECUTE PROCEDURE object_permissions_invalidate_trigger();

CREATE TRIGGER object_permissions_after_delete_trigger AFTER DELETE ON object_permissions FOR EACH ROW EXECUTE PROCEDURE object_permissions_invalidate_trigger();

`;
