import sql from "#lib/sql";

export default sql`

ALTER TABLE telegram_bot
    ADD COLUMN default_locale text,
    ADD COLUMN detect_locale_by_client_language bool NOT NULL DEFAULT TRUE;

`;
