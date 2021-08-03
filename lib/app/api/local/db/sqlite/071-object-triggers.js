import sql from "#core/sql";

export default sql`

-- CREATE TRIGGER "object_permissions_permissions_after_update_trigger" AFTER UPDATE OF "permissions" ON "object_permissions"
-- BEGIN
--     SELECT sqlite_notify('api/invalidate-object-permissions', OLD."object_id" || '/' || OLD."user_id");
-- END;

-- CREATE TRIGGER "object_permissions_enabled_after_update_trigger" AFTER UPDATE OF "enabled" ON "object_permissions"
-- WHEN (NEW."enabled" = FALSE)
-- BEGIN
--     SELECT sqlite_notify('api/invalidate-object-permissions', OLD."object_id" || '/' || OLD."user_id");
-- END;

-- CREATE TRIGGER "object_permissions_after_delete_trigger" AFTER DELETE ON "object_permissions"
-- BEGIN
--     SELECT sqlite_notify('api/invalidate-object-permissions', OLD."object_id" || '/' || OLD."user_id");
-- END;

`;
