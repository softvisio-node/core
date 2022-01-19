import sql from "#lib/sql";

export default sql`

ALTER TABLE user_action_token ADD COLUMN expires timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;

`;
