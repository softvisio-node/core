import sql from "#lib/sql";

export default sql`

CREATE TABLE notification_user_profile (
    notification text NOT NULL,
    user_id int8 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    internal bool,
    email bool,
    telegram bool,
    push bool
);

CREATE FUNCTION get_notification_user_profile ( _user_id int8 ) RETURNS json AS $$
BEGIN

    RETURN ( SELECT json_object_agg( notification, json_create_object(
        'internal', internal,
        'email', email,
        'telegram', telegram,
        'push', push
    ) ) FROM notification_user_profile WHERE user_id = _user_id );

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

`;
