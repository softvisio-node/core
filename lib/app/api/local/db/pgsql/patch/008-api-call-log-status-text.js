import sql from "#core/sql";

export default sql`

ALTER TABLE "api_call_log" RENAME COLUMN "reason" TO "status_text";

`;
