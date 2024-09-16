import sql from "#lib/sql";

export default sql`

CREATE SEQUENCE acl_notification_id_seq AS int8 MAXVALUE ${ Number.MAX_SAFE_INTEGER };

CREATE TABLE acl_notification (
    id int53 PRIMARY KEY DEFAULT nextval( 'acl_notification_id_seq' ),
    acl_type_id int53 NOT NULL REFERENCES acl_type ( id ) ON DELETE CASCADE,
    notification text NOT NULL,
    enabled bool NOT NULL DEFAULT TRUE,
    roles json,
    channels json,
    UNIQUE ( acl_type_id, notification )
);

ALTER SEQUENCE acl_notification_id_seq OWNED BY acl_notification.id;

CREATE TABLE acl_user_notification (
    acl_id int53 NOT NULL,
    user_id int53 NOT NULL,
    acl_notification_id int53 REFERENCES acl_notification ( id ) ON DELETE CASCADE,
    internal bool,
    email bool,
    telegram bool,
    push bool,
    PRIMARY KEY ( acl_id, user_id, acl_notification_id ),
    FOREIGN KEY ( acl_id, user_id ) REFERENCES acl_user ( acl_id, user_id ) ON DELETE CASCADE
);

`;
