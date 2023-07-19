import sql from "#lib/sql";

export default sql`

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
