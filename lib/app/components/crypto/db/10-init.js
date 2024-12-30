import sql from "#lib/sql";

export default sql`

CREATE TABLE crypto_key (
    id serial4 PRIMARY KEY,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked timestamptz,
    key text NOT NULL
);

CREATE UNIQUE INDEX crypto_key_revoked_key ON crypto_key ( revoked ) WHERE revoked IS NULL;

CREATE FUNCTION crypto_key_revoked_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    IF NEW.revoked IS NOT NULL THEN
        PERFORM pg_notify( 'crypto/key/revoked/update', json_build_object(
            'id', NEW.id,
            'revoked', NEW.revoked
        )::text );
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER crypto_key_revoked_after_update AFTER UPDATE OF revoked ON crypto_key FOR EACH ROW EXECUTE FUNCTION crypto_key_revoked_after_update_trigger();

`;
