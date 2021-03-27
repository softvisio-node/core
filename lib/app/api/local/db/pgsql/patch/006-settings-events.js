const sql = require( "@softvisio/core/sql" );

module.exports = sql`

ALTER TABLE "settings" ADD COLUMN "updated" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE FUNCTION settings_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    UPDATE "settings" SET "updated" = CURRENT_TIMESTAMP WHERE "id" = NEW."id";

    PERFORM pg_notify('api/settings/update', NEW."updated"::text);

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "settings_after_update_trigger" AFTER UPDATE ON "settings" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE PROCEDURE settings_after_update_trigger();

`;
