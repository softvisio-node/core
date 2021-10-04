import sql from "#lib/sql";

export default sql`

CREATE TRIGGER "userSession_after_delete_trigger" AFTER DELETE ON "userSession" FOR EACH ROW EXECUTE PROCEDURE userToken_invalidate_trigger();

`;
