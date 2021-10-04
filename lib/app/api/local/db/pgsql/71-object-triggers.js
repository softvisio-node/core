import sql from "#lib/sql";

export default sql`

CREATE FUNCTION objectPermissions_invalidate_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('api/invalidate-object-permissions', OLD."objectId"::text || '/' || OLD."userId"::text);

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "objectPermissions_permissions_after_update_trigger" AFTER UPDATE OF "permissions" ON "objectPermissions" FOR EACH ROW EXECUTE PROCEDURE objectPermissions_invalidate_trigger();

CREATE TRIGGER "objectPermissions_enabled_after_update_trigger" AFTER UPDATE OF "enabled" ON "objectPermissions" FOR EACH ROW WHEN (NEW."enabled" = FALSE) EXECUTE PROCEDURE objectPermissions_invalidate_trigger();

CREATE TRIGGER "objectPermissions_after_delete_trigger" AFTER DELETE ON "objectPermissions" FOR EACH ROW EXECUTE PROCEDURE objectPermissions_invalidate_trigger();

`;
