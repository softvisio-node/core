import sql from "#lib/sql";

export default sql`

CREATE TYPE telegram_bot_channel_status AS ENUM ( 'leave', 'kicked', 'administrator' );

CREATE TABLE telegram_bot_channel (
    telegram_bot_id int53 NOT NULL REFERENCES telegram_bot ( id ) ON DELETE CASCADE,
    telegram_channel_id int53 NOT NULL REFERENCES telegram_channel ( id ) ON DELETE RESTRICT,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status telegram_bot_channel_status NOT NULL,
    can_be_edited bool NOT NULL,
    can_manage_chat bool NOT NULL,
    can_change_info bool NOT NULL,
    can_post_messages bool NOT NULL,
    can_edit_messages bool NOT NULL,
    can_delete_messages bool NOT NULL,
    can_invite_users bool NOT NULL,
    can_restrict_members bool NOT NULL,
    can_promote_members bool NOT NULL,
    can_manage_video_chats bool NOT NULL,
    can_post_stories bool NOT NULL,
    can_edit_stories bool NOT NULL,
    can_delete_stories bool NOT NULL,
    is_anonymous bool NOT NULL,
    can_manage_voice_chats bool NOT NULL,
    PRIMARY KEY ( telegram_bot_id, telegram_channel_id )
);

-- after update
CREATE FUNCTION telegram_bot_channel_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'telegram/telegram-bot-channel/' || NEW.telegram_bot_id || '/update', json_build_object(
        'id', NEW.telegram_channel_id,
        'data', row_to_json( NEW )
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_channel_after_update AFTER UPDATE ON telegram_bot_channel FOR EACH ROW EXECUTE FUNCTION telegram_bot_channel_after_update_trigger();

`;
