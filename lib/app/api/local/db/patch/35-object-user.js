import sql from "#lib/sql";

export default sql`

CREATE FUNCTION object_after_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM object_user WHERE object_id = OLD.id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

`;
