import sql from "#lib/sql";

export default sql`

CREATE FUNCTION userToken_invalidate_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('api/invalidate-user-token', OLD."id"::text);

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "userToken_permissions_after_update_trigger" AFTER UPDATE OF "permissions" ON "userToken" FOR EACH ROW EXECUTE PROCEDURE userToken_invalidate_trigger();

CREATE TRIGGER "userToken_enabled_after_update_trigger" AFTER UPDATE OF "enabled" ON "userToken" FOR EACH ROW WHEN (NEW."enabled" = FALSE) EXECUTE PROCEDURE userToken_invalidate_trigger();

CREATE TRIGGER "userToken_after_delete_trigger" AFTER DELETE ON "userToken" FOR EACH ROW EXECUTE PROCEDURE userToken_invalidate_trigger();

`;
