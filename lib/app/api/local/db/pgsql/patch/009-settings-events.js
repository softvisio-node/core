import sql from "#lib/sql";

export default sql`

CREATE OR REPLACE FUNCTION settings_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('api/settings-update', '');

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

`;
