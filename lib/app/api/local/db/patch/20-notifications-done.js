import sql from "#lib/sql";

export default sql`
ALTER TABLE notification ALTER COLUMN expires DROP NOT NULL;

DROP INDEX notification_user_notification_id_user_id_deleted_idx;

ALTER TABLE notification_user RENAME TO user_notification;
ALTER TABLE user_notification DROP COLUMN deleted;

ALTER TABLE user_notification ADD COLUMN done bool NOT NULL DEFAULT FALSE;
CREATE INDEX user_notification_user_id_done_idx ON user_notification ( user_id, done );

`;
