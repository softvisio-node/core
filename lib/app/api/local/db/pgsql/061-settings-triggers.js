import sql from "#lib/sql";

export default sql`

CREATE FUNCTION settings_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('api/settings-update', '');

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "settings_after_update_trigger" AFTER UPDATE ON "settings" FOR EACH ROW EXECUTE PROCEDURE settings_after_update_trigger();

`;
