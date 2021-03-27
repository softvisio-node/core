const sql = require( "@softvisio/core/sql" );

module.exports = sql`

ALTER TABLE "settings" ADD COLUMN "updated" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TRIGGER "settings_after_update_trigger" AFTER UPDATE ON "settings"
BEGIN
    UPDATE "settings" SET "updated" = strftime('%Y-%m-%d %H:%M:%f', 'NOW');
END;

CREATE TRIGGER "settings_updated_after_update_trigger" AFTER UPDATE OF "updated" ON "settings"
BEGIN
    SELECT sqlite_notify('api/settings/update', NEW."updated");
END;

`;
