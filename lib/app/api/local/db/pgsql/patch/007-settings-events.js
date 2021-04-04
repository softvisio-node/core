const sql = require( "@softvisio/core/sql" );

module.exports = sql`

DROP TRIGGER IF EXISTS "settings_after_update_trigger" ON "settings";

CREATE TRIGGER "settings_after_update_trigger" AFTER UPDATE ON "settings" FOR EACH ROW EXECUTE PROCEDURE settings_after_update_trigger();

`;
