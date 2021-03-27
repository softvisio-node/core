const sql = require( "@softvisio/core/sql" );

module.exports = sql`

CREATE FUNCTION settings_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('api/settings/update', OLD."id");

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "settings_after_update_trigger" AFTER UPDATE ON "settings" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE PROCEDURE settings_after_update_trigger();

`;
