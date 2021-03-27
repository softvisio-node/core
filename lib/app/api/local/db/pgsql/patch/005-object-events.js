const sql = require( "@softvisio/core/sql" );

module.exports = sql`

CREATE FUNCTION object_permissions_invalidate_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('api/object-permissions-cache/invalidate', OLD."object_id"::text || '/' || OLD."user_id");

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "object_permissions_permissions_after_update_trigger" AFTER UPDATE OF "permissions" ON "object_permissions" FOR EACH ROW EXECUTE PROCEDURE object_permissions_invalidate_trigger();

CREATE TRIGGER "object_permissions_enabled_after_update_trigger" AFTER UPDATE OF "enabled" ON "object_permissions" FOR EACH ROW WHEN (NEW."enabled" = FALSE) EXECUTE PROCEDURE object_permissions_invalidate_trigger();

CREATE TRIGGER "object_permissions_after_delete_trigger" AFTER DELETE ON "object_permissions" FOR EACH ROW EXECUTE PROCEDURE object_permissions_invalidate_trigger();

`;
