const sql = require( "@softvisio/core/sql" );

module.exports = sql`

CREATE TRIGGER "user_name_permissions_after_update_trigger" AFTER UPDATE OF "name", "permissions" ON "user"
BEGIN
    SELECT sqlite_notify('api/auth-cache/invalidate/user', OLD."id");
END;

CREATE TRIGGER "user_enabled_after_update_trigger" AFTER UPDATE OF "enabled" ON "user"
WHEN (NEW."enabled" = FALSE)
BEGIN
    SELECT sqlite_notify('api/auth-cache/invalidate/user', OLD."id");
END;

CREATE TRIGGER "user_after_delete_trigger" AFTER DELETE ON "user"
BEGIN
    SELECT sqlite_notify('api/auth-cache/invalidate/user', OLD."id");
END;

CREATE TRIGGER "user_hash_hash_after_update_trigger" AFTER UPDATE OF "hash" ON "user_hash"
BEGIN
    SELECT sqlite_notify('api/auth-cache/invalidate/user', OLD."user_id");
END;

`;
