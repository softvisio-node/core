import sql from "#lib/sql";

export default sql`

CREATE OR REPLACE FUNCTION user_after_update_trigger() RETURNS TRIGGER AS $$
DECLARE
    data jsonb;
BEGIN

    IF OLD.enabled != NEW.enabled THEN
        IF data IS NULL THEN
            data:= '{}';
        END IF;

        data:= ( SELECT jsonb_set( data, '{enabled}', to_jsonb( NEW.enabled ), TRUE ) );
    END IF;

    IF OLD.locale != NEW.locale THEN
        IF data IS NULL THEN
            data:= '{}';
        END IF;

        IF NEW.locale IS NULL THEN
            data:= ( SELECT jsonb_set_lax( data, '{locale}', NEW.locale, TRUE, 'use_json_null' ) );
        ELSE
            data:= ( SELECT jsonb_set( data, '{locale}', to_jsonb( NEW.locale ), TRUE ) );
        END IF;
    END IF;

    IF OLD.email != NEW.email THEN
        IF data IS NULL THEN
            data:= '{}';
        END IF;

        data:= ( SELECT jsonb_set( data, '{email}', to_jsonb( NEW.email ), TRUE ) );
    END IF;

    IF OLD.email_confirmed != NEW.email_confirmed THEN
        IF data IS NULL THEN
            data:= '{}';
        END IF;

        data:= ( SELECT jsonb_set( data, '{email_confirmed}', to_jsonb( NEW.email_confirmed ), TRUE ) );
    END IF;

    IF data IS NOT NULL THEN
        data:= ( SELECT jsonb_set( data, '{id}', to_jsonb( NEW.id ), TRUE ) );

       PERFORM pg_notify( 'users/user/update', data::text );
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

`;
