import sql from "#lib/sql";

export default sql`

CREATE OR REPLACE FUNCTION telegram_bot_user_after_update_trigger() RETURNS TRIGGER AS $$
DECLARE
    data jsonb;
BEGIN

    -- subscribed changed
    IF NEW.subscribed != OLD.subscribed THEN
        UPDATE
            telegram_bot
        SET
            total_subscribed_users = CASE
                WHEN NEW.subscribed THEN total_subscribed_users + 1
                ELSE total_subscribed_users - 1
                END,
            total_unsubscribed_users = CASE
                WHEN NEW.subscribed THEN total_unsubscribed_users - 1
                ELSE total_unsubscribed_users + 1
                END,
            total_returned_users = CASE
                WHEN NOT NEW.returned THEN total_returned_users
                WHEN NEW.subscribed THEN total_returned_users + 1
                ELSE total_returned_users - 1
                END
        WHERE
            id = NEW.telegram_bot_id
        ;

        -- link
        UPDATE
            telegram_bot_link
        SET
            total_subscribed_users =
                CASE WHEN NEW.subscribed THEN total_subscribed_users + 1
                ELSE total_subscribed_users - 1
                END,
            total_unsubscribed_users = CASE
                WHEN NEW.subscribed THEN total_unsubscribed_users - 1
                ELSE total_unsubscribed_users + 1
                END,
            total_returned_users = CASE
                WHEN NOT NEW.returned THEN total_returned_users
                WHEN NEW.subscribed THEN total_returned_users + 1
                ELSE total_returned_users - 1
                END
        FROM
            telegram_bot_user_link
        WHERE
            telegram_bot_user_link.telegram_bot_id = NEW.telegram_bot_id
            AND telegram_bot_user_link.telegram_user_id = NEW.telegram_user_id
            AND telegram_bot_user_link.telegram_bot_link_id = telegram_bot_link.id
        ;
    END IF;

    -- enabled changed
    IF NEW.enabled != OLD.enabled THEN
        UPDATE
            telegram_bot
        SET
            total_disabled_users = CASE
                WHEN NEW.enabled THEN total_disabled_users - 1
                ELSE total_disabled_users + 1
                END
        WHERE
            id = NEW.telegram_bot_id;

        UPDATE
            telegram_bot_link
        SET
            total_disabled_users = CASE
                WHEN NEW.enabled THEN total_disabled_users - 1
                ELSE total_disabled_users + 1
                END
        FROM
            telegram_bot_user_link
        WHERE
            telegram_bot_user_link.telegram_bot_id = NEW.telegram_bot_id
            AND telegram_bot_user_link.telegram_user_id = NEW.telegram_user_id
            AND telegram_bot_user_link.telegram_bot_link_id = telegram_bot_link.id;
    END IF;

    IF OLD.api_user_id != NEW.api_user_id THEN
        data:= ( SELECT jsonb_set_lax( coalesce( data, '{}' ), '{api_user_id}', to_jsonb( NEW.api_user_id ), TRUE, 'use_json_null' ) );
    END IF;

    IF OLD.subscribed != NEW.subscribed THEN
        data:= ( SELECT jsonb_set_lax( coalesce( data, '{}' ), '{subscribed}', to_jsonb( NEW.subscribed ), TRUE, 'use_json_null' ) );
    END IF;

    IF OLD.returned != NEW.returned THEN
        data:= ( SELECT jsonb_set_lax( coalesce( data, '{}' ), '{returned}', to_jsonb( NEW.returned ), TRUE, 'use_json_null' ) );
    END IF;

    IF OLD.enabled != NEW.enabled THEN
        data:= ( SELECT jsonb_set_lax( coalesce( data, '{}' ), '{enabled}', to_jsonb( NEW.enabled ), TRUE, 'use_json_null' ) );
    END IF;

    IF OLD.locale != NEW.locale THEN
        data:= ( SELECT jsonb_set_lax( coalesce( data, '{}' ), '{locale}', to_jsonb( NEW.locale ), TRUE, 'use_json_null' ) );
    END IF;

    IF data IS NOT NULL THEN
        data:= ( SELECT jsonb_set( data, '{id}', to_jsonb( NEW.telegram_user_id ), TRUE ) );

       PERFORM pg_notify( 'telegram/telegram-bot-user/' || NEW.telegram_bot_id || '/update', data::text );
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

`;
