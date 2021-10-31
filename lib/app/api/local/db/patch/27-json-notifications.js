import sql from "#lib/sql";
import CONST from "#lib/const";

export default sql`

CREATE OR REPLACE FUNCTION user_invalidate_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/invalidate-user', json_build_object( 'id', OLD.id::text )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION user_disabled_trigger() RETURNS TRIGGER AS $$
BEGIN

    -- remove user sessions
    DELETE FROM user_session WHERE user_id = OLD.id;

    PERFORM pg_notify( 'api/invalidate-user', json_build_object( 'id', OLD.id::text )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION user_invalidate_hash_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/invalidate-user-token', json_build_object( 'token_type', ${CONST.AUTH_USER}, 'token_id', ( SELECT name FROM "user" WHERE id = OLD.user_id ) )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION user_token_invalidate_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/invalidate-user-token', json_build_object( 'token_type', ${CONST.AUTH_TOKEN}, 'token_id', OLD.id::text )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION user_session_invalidate_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/invalidate-user-token', json_build_object( 'token_type', ${CONST.AUTH_SESSION}, 'token_id', OLD.id::text )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION object_permissions_invalidate_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( 'api/invalidate-object-permissions', json_build_object( 'object_id', OLD.object_id::text, 'user_id', OLD.user_id::text )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

`;
