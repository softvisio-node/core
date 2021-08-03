import sql from "#core/sql";

export default sql`

CREATE OR REPLACE FUNCTION user_token_invalidate_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('api/invalidate-user-token', OLD."id"::text);

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

`;
