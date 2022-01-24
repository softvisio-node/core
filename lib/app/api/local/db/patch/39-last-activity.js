import sql from "#lib/sql";

export default sql`

ALTER TABLE user_session RENAME COLUMN last_used TO last_activity;
ALTER TABLE user_token ADD COLUMN last_activity timestamptz;
ALTER TABLE "user" ADD COLUMN last_activity timestamptz;

`;
