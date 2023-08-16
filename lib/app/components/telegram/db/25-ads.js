import sql from "#lib/sql";

export default sql`

CREATE TABLE telegram_bot_ad_campaign (
    id serial8 PRIMARY KEY,
    guid uuig NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    name text NOT NULL,
    telegram_bot_id int8 NOT NULL REFERENCES telegram_bot ( id ) ON DELETE CASCADE
);

`;
