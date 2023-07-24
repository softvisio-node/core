import sql from "#lib/sql";

export default sql`

CREATE TABLE user_notification (
    user_id int8 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    notification text NOT NULL,
    internal bool,
    email bool,
    telegram bool,
    push bool,
    PRIMARY KEY ( user_id, notification )
);

CREATE FUNCTION get_user_notifications ( _user_id int8 ) RETURNS json AS $$
BEGIN

    RETURN ( SELECT json_object_agg( notification, json_build_object(
        'internal', internal,
        'email', email,
        'telegram', telegram,
        'push', push
    ) ) FROM user_notification WHERE user_id = _user_id );

END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION user_notification_trigger() RETURNS TRIGGER AS $$
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

    PERFORM pg_notify( 'users/user-notification/update', json_build_object(
        'id', _user_id::text,
        'notifications', get_user_notifications( _user_id )
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_notification_after_update AFTER INSERT OR UPDATE OR DELETE ON user_notification FOR EACH ROW EXECUTE FUNCTION user_notification_trigger();

`;
