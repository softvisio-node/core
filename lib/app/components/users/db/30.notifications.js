import sql from "#lib/sql";

export default sql`

CREATE TABLE notification_user_profile (
    id serial8 PRIMARY KEY,
    user_id int8 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    type text NOT NULL,
    channel text NOT NULL,
    enabled bool NOT NULL,
    UNIQUE ( user_id, type, channel )
);

CREATE TABLE notification_internal (
    id serial8 PRIMARY KEY,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires timestamptz,
    subject text NOT NULL,
    body text NOT NULL
);

CREATE TABLE notification_internal_user (
    id serial8 PRIMARY KEY,
    user_id int8 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    notification_internal_id int8 NOT NULL REFERENCES notification_internal ( id ) ON DELETE CASCADE,
    done bool NOT NULL DEFAULT FALSE
);

CREATE INDEX notification_internal_user_user_id_done_idx ON notification_internal_user ( user_id, done );

CREATE FUNCTION get_notification_user_profile ( _user_id int8 ) RETURNS json AS $$
BEGIN

    RETURN ( WITH cte AS (
        SELECT
            type,
            json_object_agg( channel, enabled ) AS channels
        FROM
            notification_user_profile
        WHERE
            user_id = _user_id
        GROUP BY
            type
    )
    SELECT json_object_agg( type, channels ) FROM cte );

END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION notification_user_profile_trigger() RETURNS TRIGGER AS $$
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
        'notifications', get_notification_user_profile( _user_id )
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notification_user_profile_after_update AFTER INSERT OR UPDATE OR DELETE ON notification_user_profile FOR EACH ROW EXECUTE FUNCTION notification_user_profile_trigger();

CREATE FUNCTION notification_internal_user_after_delete_trigger() RETURNS TRIGGER AS $$
BEGIN

    IF NOT EXISTS ( SELECT FROM notification_internal_user WHERE notification_internal_id = OLD.notification_internal_id ) THEN
        DELETE FROM notification_internal WHERE id = OLD.notification_internal_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notification_internal_user_after_delete AFTER DELETE ON notification_internal_user FOR EACH ROW EXECUTE FUNCTION notification_internal_user_after_delete_trigger();

`;
