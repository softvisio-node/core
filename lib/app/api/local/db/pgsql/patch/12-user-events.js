import sql from "#lib/sql";

export default sql`

CREATE OR REPLACE FUNCTION user_invalidate_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('api/invalidate-user', OLD."id"::text);

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION user_invalidate_hash_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('api/invalidate-user', OLD."user_id"::text);

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

`;
