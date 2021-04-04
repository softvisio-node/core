const sql = require( "@softvisio/core/sql" );

module.exports = sql`

CREATE TRIGGER "user_token_permissions_after_update_trigger" AFTER UPDATE OF "permissions" ON "user_token"
BEGIN
    SELECT sqlite_notify('api/auth-cache/invalidate/user-token', OLD."id");
END;

CREATE TRIGGER "user_token_enabled_after_update_trigger" AFTER UPDATE OF "enabled" ON "user_token"
WHEN (NEW."enabled" = FALSE)
BEGIN
    SELECT sqlite_notify('api/auth-cache/invalidate/user-token', OLD."id");
END;

CREATE TRIGGER "user_token_after_delete_trigger" AFTER DELETE ON "user_token"
BEGIN
    SELECT sqlite_notify('api/auth-cache/invalidate/user-token', OLD."id");
END;

`;
