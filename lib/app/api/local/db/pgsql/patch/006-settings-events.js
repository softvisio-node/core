const sql = require( "@softvisio/core/sql" );

module.exports = sql`

ALTER TABLE "settings" ADD COLUMN "updated" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE FUNCTION settings_before_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    NEW."updated" = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "settings_before_update_trigger" BEFORE UPDATE ON "settings" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE PROCEDURE settings_before_update_trigger();

CREATE FUNCTION settings_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('api/settings/update', NEW."updated"::text);

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "settings_after_update_trigger" AFTER UPDATE ON "settings" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE PROCEDURE settings_after_update_trigger();

`;
