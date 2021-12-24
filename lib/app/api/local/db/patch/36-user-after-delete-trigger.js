import sql from "#lib/sql";

export default sql`

CREATE OR REPLACE FUNCTION user_after_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/user/delete', json_build_object( 'user_id', OLD.id::text )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

`;
