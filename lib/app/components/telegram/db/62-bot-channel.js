import sql from "#lib/sql";

export default sql`

CREATE TYPE telegram_bot_channel_status AS ENUM ( 'creator', 'administrator', 'member', 'restricted', 'left', 'kicked' );

CREATE TABLE telegram_bot_channel (
    telegram_bot_id int53 NOT NULL REFERENCES telegram_bot ( id ) ON DELETE CASCADE,
    telegram_channel_id int53 NOT NULL REFERENCES telegram_channel ( id ) ON DELETE RESTRICT,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status telegram_bot_channel_status NOT NULL,
    can_be_edited boolean NOT NULL,
    can_manage_chat boolean NOT NULL,
    can_change_info boolean NOT NULL,
    can_post_messages boolean NOT NULL,
    can_edit_messages boolean NOT NULL,
    can_delete_messages boolean NOT NULL,
    can_invite_users boolean NOT NULL,
    can_restrict_members boolean NOT NULL,
    can_promote_members boolean NOT NULL,
    can_manage_video_chats boolean NOT NULL,
    can_post_stories boolean NOT NULL,
    can_edit_stories boolean NOT NULL,
    can_delete_stories boolean NOT NULL,
    is_anonymous boolean NOT NULL,
    can_manage_voice_chats boolean NOT NULL,
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
