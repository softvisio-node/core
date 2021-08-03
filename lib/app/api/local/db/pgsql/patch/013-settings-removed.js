import sql from "#core/sql";

export default sql`

DROP TRIGGER "settings_after_update_trigger" ON "settings";
DROP FUNCTION settings_after_update_trigger;
DROP TABLE "settings";

`;
