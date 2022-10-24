import sql from "#lib/sql";

export default sql`

CREATE TABLE user_notification_type_channel (
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

CREATE TABLE telegram_user (
    id int8 PRIMARY KEY, -- telegram user id / telegram chat id
    name text NOT NULL UNIQUE -- telegram username
);

CREATE INDEX user_internal_notification_user_id_done_idx ON user_internal_notification ( user_id, done );

CREATE FUNCTION get_user_notifications ( _user_id int8 ) RETURNS json AS $$
BEGIN

    RETURN ( WITH cte AS (
        SELECT
            type,
            json_object_agg( channel, enabled ) AS channels
        FROM
            user_notification_type_channel
        WHERE
            user_id = _user_id
        GROUP BY
            type
    )
    SELECT json_object_agg( type, channels ) FROM cte );

END;
$$ LANGUAGE plpgsql;

-- XXX watch deleted user
CREATE FUNCTION user_notification_type_channel_trigger() RETURNS TRIGGER AS $$
BEGIN

    -- user was deleted
    IF TG_OP = 'DELETE' AND NOT EXISTS ( SELECT FROM "user" WHERE id = OLD.user_id ) THEN
        RETURN NULL;
    END IF;

    PERFORM pg_notify( 'api/user-notifications/update', json_build_object(
        'id', OLD.user_id::text,
        'notifications', get_user_notifications( NEW.user_id )
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_notification_type_channel_after_update AFTER INSERT OR UPDATE OR DELETE ON user_notification_type_channel FOR EACH ROW EXECUTE FUNCTION user_notification_type_channel_trigger();

CREATE FUNCTION telegram_user_after_insert_trigger() RETURNS TRIGGER AS $$
BEGIN
    UPDATE "user" SET telegram_user_id = NEW.id WHERE telegram_username = NEW.name;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_user_after_insert AFTER INSERT ON telegram_user FOR EACH ROW EXECUTE FUNCTION telegram_user_after_insert_trigger();

CREATE FUNCTION telegram_user_after_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
    UPDATE "user" SET telegram_user_id = NULL WHERE telegram_username = OLD.name;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_user_after_delete AFTER DELETE ON telegram_user FOR EACH ROW EXECUTE FUNCTION telegram_user_after_delete_trigger();

`;
