import sql from "#lib/sql";

export default sql`

CREATE SEQUENCE telegram_bot_group_id_seq AS int8 MAXVALUE ${ Number.MAX_SAFE_INTEGER };

CREATE TABLE telegram_bot_group (
    id int53 PRIMARY KEY DEFAULT nextval( 'telegram_bot_group_id_seq' ),
    telegram_bot_id int53 NOT NULL REFERENCES telegram_bot ( id ) ON DELETE CASCADE,
    telegram_group_id int53 NOT NULL REFERENCES telegram_group ( id ) ON DELETE RESTRICT,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status text NOT NULL, -- XXX leave, kicked, administrator
    can_be_edited bool NOT NULL,
    can_manage_chat bool NOT NULL,
    can_change_info bool NOT NULL,
    can_delete_messages bool NOT NULL,
    can_invite_users bool NOT NULL,
    can_restrict_members bool NOT NULL,
    can_pin_messages bool NOT NULL,
    can_manage_topics bool NOT NULL,
    can_promote_members bool NOT NULL,
    can_manage_video_chats bool NOT NULL,
    can_post_stories bool NOT NULL,
    can_edit_stories bool NOT NULL,
    can_delete_stories bool NOT NULL,
    is_anonymous bool NOT NULL,
    can_manage_voice_chats bool NOT NULL,
    UNIQUE ( telegram_bot_id, telegram_group_id )
);

ALTER SEQUENCE telegram_bot_group_id_seq OWNED BY telegram_bot_group.id;

-- after update
CREATE FUNCTION telegram_bot_group_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    PERFORM pg_notify( 'telegram/telegram-bot-group/' || NEW.telegram_bot_id || '/update', json_build_object(
        'id', NEW.id,
        'data': row_to_json( NEW )
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telegram_bot_group_after_update AFTER UPDATE ON telegram_bot_group FOR EACH ROW EXECUTE FUNCTION telegram_bot_group_after_update_trigger();

`;
