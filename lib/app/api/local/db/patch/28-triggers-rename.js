import sql from "#lib/sql";

export default sql`

DROP TRIGGER user_before_insert_trigger ON "user";
CREATE TRIGGER user_before_insert BEFORE INSERT ON "user" FOR EACH ROW EXECUTE FUNCTION user_before_insert_trigger();

DROP TRIGGER user_name_before_update_trigger ON "user";
CREATE TRIGGER user_name_before_update BEFORE UPDATE OF name ON "user" FOR EACH ROW EXECUTE FUNCTION user_name_before_update_trigger();

DROP TRIGGER user_email_before_update_trigger ON "user";
CREATE TRIGGER user_email_before_update BEFORE UPDATE OF email ON "user" FOR EACH ROW EXECUTE FUNCTION user_email_before_update_trigger();

DROP TRIGGER user_name_permissions_after_update_trigger ON "user";
CREATE TRIGGER user_name_permissions_after_update AFTER UPDATE OF name, permissions ON "user" FOR EACH ROW EXECUTE FUNCTION user_invalidate_trigger();

DROP TRIGGER user_disabled_trigger ON "user";
CREATE TRIGGER user_disabled AFTER UPDATE OF enabled ON "user" FOR EACH ROW WHEN ( NEW.enabled = FALSE ) EXECUTE FUNCTION user_disabled_trigger();

DROP TRIGGER user_after_delete_trigger ON "user";
CREATE TRIGGER user_after_delete AFTER DELETE ON "user" FOR EACH ROW EXECUTE FUNCTION user_invalidate_trigger();

DROP TRIGGER user_hash_hash_after_update_trigger ON user_hash;
CREATE TRIGGER user_hash_hash_after_update AFTER UPDATE OF hash ON user_hash FOR EACH ROW EXECUTE FUNCTION user_invalidate_hash_trigger();

DROP TRIGGER user_token_permissions_after_update_trigger ON user_token;
CREATE TRIGGER user_token_permissions_after_update AFTER UPDATE OF permissions ON user_token FOR EACH ROW EXECUTE FUNCTION user_token_invalidate_trigger();

DROP TRIGGER user_token_enabled_after_update_trigger ON user_token;
CREATE TRIGGER user_token_enabled_after_update AFTER UPDATE OF enabled ON user_token FOR EACH ROW WHEN ( NEW.enabled = FALSE ) EXECUTE FUNCTION user_token_invalidate_trigger();

DROP TRIGGER user_token_after_delete_trigger ON user_token;
CREATE TRIGGER user_token_after_delete AFTER DELETE ON user_token FOR EACH ROW EXECUTE FUNCTION user_token_invalidate_trigger();

DROP TRIGGER user_session_after_delete_trigger ON user_session;
CREATE TRIGGER user_session_after_delete AFTER DELETE ON user_session FOR EACH ROW EXECUTE FUNCTION user_session_invalidate_trigger();

DROP TRIGGER object_permissions_permissions_after_update_trigger ON object_permissions;
CREATE TRIGGER object_permissions_permissions_after_update AFTER UPDATE OF permissions ON object_permissions FOR EACH ROW EXECUTE FUNCTION object_permissions_invalidate_trigger();

DROP TRIGGER object_permissions_enabled_after_update_trigger ON object_permissions;
CREATE TRIGGER object_permissions_enabled_after_update AFTER UPDATE OF enabled ON object_permissions FOR EACH ROW WHEN ( NEW.enabled = FALSE ) EXECUTE FUNCTION object_permissions_invalidate_trigger();

DROP TRIGGER object_permissions_after_delete_trigger ON object_permissions;
CREATE TRIGGER object_permissions_after_delete AFTER DELETE ON object_permissions FOR EACH ROW EXECUTE FUNCTION object_permissions_invalidate_trigger();

`;
