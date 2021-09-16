import sql from "#lib/sql";

export default sql`

DROP TRIGGER "user_enabled_after_update_trigger";

CREATE TRIGGER "user_disabled_trigger" AFTER UPDATE OF "enabled" ON "user"
WHEN (NEW."enabled" = FALSE)
BEGIN

    -- drop user sessions
    DELETE FROM "user_session" WHERE "user_id" = OLD."id";

    SELECT sqlite_notify('api/invalidate-user', OLD."id");
END;

`;
