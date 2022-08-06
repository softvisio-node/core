import sql from "#lib/sql";

export default sql`

CREATE FUNCTION acl_object_after_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM acl WHERE object_id = OLD.id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

`;
