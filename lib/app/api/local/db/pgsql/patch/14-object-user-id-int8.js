import sql from "#lib/sql";

export default sql`

ALTER TABLE "object_permissions" ALTER COLUMN "user_id" TYPE int8;

`;
