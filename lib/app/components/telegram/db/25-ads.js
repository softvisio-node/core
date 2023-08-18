import sql from "#lib/sql";

export default sql`

CREATE TABLE telegram_bot_ad_campaign (
    id serial8 PRIMARY KEY,
    guid uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    name text NOT NULL,
    description text,
    telegram_bot_id int8 NOT NULL REFERENCES telegram_bot ( id ) ON DELETE CASCADE,
    total_users int4 NOT NULL DEFAULT 0,
    total_subscribed_users int4 NOT NULL DEFAULT 0

);

CREATE TABLE telegram_bot_ad_capmaign_stats (
    date timestamptz NOT NULL,
    telegram_bot_ad_campaign_id int8 REFERENCES telegram_bot_ad_campaign ( id ) ON DELETE CASCADE,
    subscribed_users int4 NOT NULL DEFAULT 0,
    unsubscribed_users int4 NOT NULL DEFAULT 0,
    PRIMARY KEY ( date, telegram_bot_ad_campaign_id )
);

`;
