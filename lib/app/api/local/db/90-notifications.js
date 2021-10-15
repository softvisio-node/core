import sql from "#lib/sql";

export default sql`

CREATE TABLE notification (
    id serial8 PRIMARY KEY NOT NULL,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires timestamptz,
    subject text NOT NULL,
    body text NOT NULL,
    meta json NOT NULL DEFAULT '{}'
);

CREATE TABLE user_notification (
    id serial8 PRIMARY KEY NOT NULL,
    user_id int8 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    notification_id int8 NOT NULL REFERENCES notification ( id ) ON DELETE CASCADE,
    read bool NOT NULL DEFAULT FALSE,
    done bool NOT NULL DEFAULT FALSE
);

CREATE INDEX user_notification_user_id_done_idx ON user_notification ( user_id, done );

`;
