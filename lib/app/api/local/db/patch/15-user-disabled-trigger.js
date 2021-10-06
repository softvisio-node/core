import sql from "#lib/sql";

export default sql`

CREATE FUNCTION user_disabled_trigger() RETURNS TRIGGER AS $$
BEGIN

    -- remove user sessions
    DELETE FROM "user_session" WHERE "user_id" = OLD."id";

    PERFORM pg_notify('api/invalidate-user', OLD."id"::text);

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER "user_enabled_after_update_trigger" ON "user";

CREATE TRIGGER "user_disabled_trigger" AFTER UPDATE OF "enabled" ON "user" FOR EACH ROW WHEN (NEW."enabled" = FALSE) EXECUTE PROCEDURE user_disabled_trigger();

`;
