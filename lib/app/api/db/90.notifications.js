import sql from "#lib/sql";

export default sql`

CREATE TABLE user_notification_type_channel (
    id serial8 PRIMARY KEY,
    user_id int8 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    type text NOT NULL,
    channel text NOT NULL,
    enabled bool NOT NULL
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

CREATE FUNCTION user_notification_type_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    IF NEW.user_id IS NOT NULL THEN
        PERFORM pg_notify( 'api/user-notification-type/update', json_build_object(
            'user_id', OLD.user_id::text,
            'type', OLD.type
        )::text );

    -- updated
    ELSE
        PERFORM pg_notify( 'api/user-notification-type/update', json_build_object( 'user_id', NEW.user_id::text, 'type', NEW.type )::text );
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_notification_type_after_update AFTER INSERT OR UPDATE OR DELETE ON user_notification_type FOR EACH ROW EXECUTE FUNCTION user_notification_type_update_trigger();


`;
