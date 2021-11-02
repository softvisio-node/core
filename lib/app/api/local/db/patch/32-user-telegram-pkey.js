import sql from "#lib/sql";

export default sql`

ALTER TABLE user_telegram DROP CONSTRAINT user_telegram_pkey;

ALTER TABLE user_telegram ADD PRIMARY KEY ( user_id );

`;
