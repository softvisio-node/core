import sql from "#lib/sql";

export default sql`

ALTER TABLE user_session ADD COLUMN last_used timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;

`;
