import sql from "#lib/sql";

export default sql`

DROP TRIGGER IF EXISTS "settings_after_update_trigger" ON "settings";

CREATE TRIGGER "settings_after_update_trigger" AFTER UPDATE ON "settings" FOR EACH ROW EXECUTE PROCEDURE settings_after_update_trigger();

`;
