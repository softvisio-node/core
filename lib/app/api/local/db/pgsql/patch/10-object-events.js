import sql from "#lib/sql";

export default sql`

CREATE OR REPLACE FUNCTION object_permissions_invalidate_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('api/invalidate-object-permissions', OLD."object_id"::text || '/' || OLD."user_id"::text);

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

`;
