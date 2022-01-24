import sql from "#lib/sql";
import constants from "#lib/app/constants";

export default sql`

CREATE OR REPLACE FUNCTION user_invalidate_hash_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify ( 'api/invalidate-user-token', ${constants.tokenTypeUserCredentials} || '/' || ( SELECT name FROM "user" WHERE id = OLD.user_id ) );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION user_token_invalidate_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify ( 'api/invalidate-user-token', ${constants.tokenTypeUserToken} || '/' || OLD.id::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION user_session_invalidate_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify ( 'api/invalidate-user-token', ${constants.tokenTypeUserSession} || '/' || OLD.id::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

`;
