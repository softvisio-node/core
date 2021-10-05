import sql from "#lib/sql";

export default sql`

CREATE TRIGGER "user_session_after_delete_trigger" AFTER DELETE ON "user_session" FOR EACH ROW EXECUTE PROCEDURE user_token_invalidate_trigger();

`;
