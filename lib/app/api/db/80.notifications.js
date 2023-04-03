import sql from "#lib/sql";

export default sql`

CREATE TABLE user_notifications_profile (
    id serial8 PRIMARY KEY,
    user_id int8 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    type text NOT NULL,
    channel text NOT NULL,
    enabled bool NOT NULL,
    UNIQUE ( user_id, type, channel )
);

CREATE TABLE internal_notification (
    id serial8 PRIMARY KEY,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires timestamptz,
    subject text NOT NULL,
    body text NOT NULL,
    meta json
);

CREATE TABLE user_internal_notification (
    id serial8 PRIMARY KEY,
    user_id int8 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    notification_id int8 NOT NULL REFERENCES internal_notification ( id ) ON DELETE CASCADE,
    read bool NOT NULL DEFAULT FALSE,
    done bool NOT NULL DEFAULT FALSE
);

CREATE INDEX user_internal_notification_user_id_done_idx ON user_internal_notification ( user_id, done );

CREATE FUNCTION get_user_notifications_profile ( _user_id int8 ) RETURNS json AS $$
BEGIN

    RETURN ( WITH cte AS (
        SELECT
            type,
            json_object_agg( channel, enabled ) AS channels
        FROM
            user_notifications_profile
        WHERE
            user_id = _user_id
        GROUP BY
            type
    )
    SELECT json_object_agg( type, channels ) FROM cte );

END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION user_notifications_profile_trigger() RETURNS TRIGGER AS $$
DECLARE
    _user_id int8;
BEGIN

    -- delete
    IF TG_OP = 'DELETE' THEN

        -- user was deleted
        IF NOT EXISTS ( SELECT FROM "user" WHERE id = OLD.user_id ) THEN
            RETURN NULL;
        END IF;

        _user_id := OLD.user_id;
    ELSE
        _user_id := NEW.user_id;
    END IF;

    PERFORM pg_notify( 'api/user-notifications/update', json_build_object(
        'id', _user_id::text,
        'notifications', get_user_notifications_profile( _user_id )
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_notifications_profile_after_update AFTER INSERT OR UPDATE OR DELETE ON user_notifications_profile FOR EACH ROW EXECUTE FUNCTION user_notifications_profile_trigger();

`;
