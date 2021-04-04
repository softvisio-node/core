const sql = require( "@softvisio/core/sql" );

module.exports = sql`

CREATE TRIGGER "settings_after_update_trigger" AFTER UPDATE ON "settings"
BEGIN
    SELECT sqlite_notify('api/settings/update', '');
END;

`;
