import sql from "#lib/sql";

export default sql`

ALTER TABLE action_token ADD COLUMN public text;

`;
