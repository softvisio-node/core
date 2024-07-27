import sql from "#lib/sql";

export default sql`

CREATE OR REPLACE FUNCTION api_token_after_update_trigger() RETURNS TRIGGER AS $$
DECLARE
    data jsonb;
BEGIN

    IF OLD.enabled != NEW.enabled THEN
        data:= ( SELECT jsonb_set_lax( coalesce( data, '{}' ), '{enabled}', to_jsonb( NEW.enabled ), TRUE, 'use_json_null' ) );
    END IF;

    IF data IS NOT NULL THEN
        data:= ( SELECT jsonb_set( data, '{id}', to_jsonb( NEW.id ), TRUE ) );

       PERFORM pg_notify( 'api/token/update', data::text );
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

`;
