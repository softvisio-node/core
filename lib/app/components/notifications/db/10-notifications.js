import sql from "#lib/sql";

export default sql`

CREATE EXTENSION IF NOT EXISTS softvisio_types;

CREATE SEQUENCE notification_internal_id_seq AS int8 MAXVALUE ${ Number.MAX_SAFE_INTEGER };

CREATE TABLE notification_internal (
    id int53 PRIMARY KEY DEFAULT nextval( 'notification_internal_id_seq' ),
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires timestamptz,
    subject text NOT NULL,
    body text NOT NULL
);

ALTER SEQUENCE notification_internal_id_seq OWNED BY notification_internal.id;

CREATE SEQUENCE notification_internal_user_id_seq AS int8 MAXVALUE ${ Number.MAX_SAFE_INTEGER };

CREATE TABLE notification_internal_user (
    id int53 PRIMARY KEY DEFAULT nextval( 'notification_internal_user_id_seq' ),
    user_id int53 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    notification_internal_id int53 NOT NULL REFERENCES notification_internal ( id ) ON DELETE CASCADE,
    done boolean NOT NULL DEFAULT FALSE
);

ALTER SEQUENCE notification_internal_user_id_seq OWNED BY notification_internal_user.id;

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
