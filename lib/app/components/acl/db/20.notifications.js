import sql from "#lib/sql";

export default sql`

CREATE TABLE acl_notification (
    id serial8 PRIMARY KEY,
    acl_type_id int8 NOT NULL REFERENCES acl_type ( id ) ON DELETE CASCADE,
    notification text NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    enabled bool NOT NULL DEFAULT TRUE,
    roles json,
    UNIQUE ( acl_type_id, notification )
);

CREATE TABLE acl_user_notification (
    acl_id int8 NOT NULL,
    user_id int8 NOT NULL,
    acl_notification_id int8 REFERENCES acl_notification ( id ) ON DELETE CASCADE,
    internal bool,
    email bool,
    telegram bool,
    push bool,
    PRIMARY KEY ( acl_id, user_id, acl_notification_id ),
    FOREIGN KEY ( acl_id, user_id ) REFERENCES acl_user ( acl_id, user_id ) ON DELETE CASCADE
);

`;
