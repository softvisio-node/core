import sql from "#core/sql";

export default sql`

CREATE TRIGGER "user_session_after_delete_trigger" AFTER DELETE ON "user_session"
BEGIN
    SELECT sqlite_notify('api/invalidate-user-token', OLD."id");
END;

`;
