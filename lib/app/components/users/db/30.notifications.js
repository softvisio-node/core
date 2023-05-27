import sql from "#lib/sql";

export default sql`

CREATE TABLE api_user_notifications_profile (
    id serial8 PRIMARY KEY,
    user_id int8 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    type text NOT NULL,
    channel text NOT NULL,
    enabled bool NOT NULL,
    UNIQUE ( user_id, type, channel )
);

CREATE TABLE api_internal_notification (
    id serial8 PRIMARY KEY,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires timestamptz,
    subject text NOT NULL,
    body text NOT NULL
);

CREATE TABLE api_user_internal_notification (
    id serial8 PRIMARY KEY,
    user_id int8 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    api_internal_notification_id int8 NOT NULL REFERENCES api_internal_notification ( id ) ON DELETE CASCADE,
    done bool NOT NULL DEFAULT FALSE
);

CREATE INDEX api_user_internal_notification_user_id_done_idx ON api_user_internal_notification ( user_id, done );

CREATE FUNCTION get_api_user_notifications_profile ( _user_id int8 ) RETURNS json AS $$
BEGIN

    RETURN ( WITH cte AS (
        SELECT
            type,
            json_object_agg( channel, enabled ) AS channels
        FROM
            api_user_notifications_profile
        WHERE
            user_id = _user_id
        GROUP BY
            type
    )
    SELECT json_object_agg( type, channels ) FROM cte );

END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION api_user_notifications_profile_trigger() RETURNS TRIGGER AS $$
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

    PERFORM pg_notify( 'users/user-notifications-profile/update', json_build_object(
        'id', _user_id::text,
        'notifications', get_api_user_notifications_profile( _user_id )
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER api_user_notifications_profile_after_update AFTER INSERT OR UPDATE OR DELETE ON api_user_notifications_profile FOR EACH ROW EXECUTE FUNCTION api_user_notifications_profile_trigger();

CREATE FUNCTION api_user_internal_notification_after_delete_trigger() RETURNS TRIGGER AS $$
BEGIN

    IF NOT EXISTS ( SELECT FROM api_user_internal_notification WHERE api_internal_notification_id = OLD.api_internal_notification_id ) THEN
        DELETE FROM api_internal_notification WHERE id = OLD.api_internal_notification_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER api_user_internal_notification_after_delete AFTER DELETE ON api_user_internal_notification FOR EACH ROW EXECUTE FUNCTION api_user_internal_notification_after_delete_trigger();

`;
