const sql = require( "@softvisio/core/sql" );

module.exports = sql`

CREATE TRIGGER "user_session_after_delete_trigger" AFTER DELETE ON "user_session"
BEGIN
    SELECT sqlite_notify('api/auth-cache/invalidate/user-token', OLD."id");
END;

`;
