import sql from "#lib/sql";

export default sql`

ALTER TABLE crypto_key ADD COLUMN revoke_date timestamptz;

CREATE OR REPLACE FUNCTION crypto_key_revoked_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    IF NEW.revoked = TRUE THEN
        PERFORM pg_notify( 'crypto/key/revoked/update', json_build_object(
            'id', NEW.id,
            'revoke_date', NEW.revoke_date
        )::text );
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;


`;
