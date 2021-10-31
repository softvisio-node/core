import sql from "#lib/sql";

export default sql`

ALTER TABLE notification RENAME TO internal_notification;

DROP TABLE user_notification;
CREATE TABLE user_internal_notification (
    id serial8 PRIMARY KEY NOT NULL,
    user_id int8 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    notification_id int8 NOT NULL REFERENCES internal_notification ( id ) ON DELETE CASCADE,
    read bool NOT NULL DEFAULT FALSE,
    done bool NOT NULL DEFAULT FALSE
);

CREATE INDEX user_internal_notification_user_id_done_idx ON user_internal_notification ( user_id, done );

`;
