const sql = require( "@softvisio/core/sql" );

module.exports = sql`

CREATE FUNCTION user_invalidate_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify("api/auth-cache/invalidate/user", OLD."id");

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "user_permissions_after_update_trigger" AFTER UPDATE OF "permissions" ON "user" FOR EACH ROW EXECUTE PROCEDURE user_invalidate_trigger();

CREATE TRIGGER "user_name_after_update_trigger" AFTER UPDATE OF "name" ON "user" FOR EACH ROW EXECUTE PROCEDURE user_invalidate_trigger();

CREATE TRIGGER "user_enabled_after_update_trigger" AFTER UPDATE OF "enabled" ON "user" FOR EACH ROW EXECUTE PROCEDURE user_invalidate_trigger();

CREATE TRIGGER "user_after_delete_trigger" AFTER DELETE ON "user" FOR EACH ROW EXECUTE PROCEDURE user_invalidate_trigger();

CREATE FUNCTION user_invalidate_hash_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify("api/auth-cache/invalidate/user", OLD."user_id");

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "user__hash_hash_after_update_trigger" AFTER UPDATE OF "hash" ON "user_hash" FOR EACH ROW EXECUTE PROCEDURE user_invalidate_hash_trigger();

`;
