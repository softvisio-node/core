import sql from "#lib/sql";
import TelegramGroup from "../group.js";
import Chat from "./chat.js";

const FIELDS = [

    //
    "status",
    "can_be_edited",
    "can_manage_chat",
    "can_change_info",
    "can_delete_messages",
    "can_invite_users",
    "can_restrict_members",
    "can_pin_messages",
    "can_manage_topics",
    "can_promote_members",
    "can_manage_video_chats",
    "can_post_stories",
    "can_edit_stories",
    "can_delete_stories",
    "is_anonymous",
    "can_manage_voice_chats",
];

export default class TelegramBotGroup extends Chat( TelegramGroup ) {
    #fields = {};

    constructor ( bot, data ) {
        super( bot, data );

        const fields = data.telegram_bot_group;

        this.updateTelegramBotGroupFields( fields );
    }

    // properties
    get status () {
        return this.#fields.status;
    }

    get canBeEdited () {
        return this.#fields.can_be_edited;
    }

    get canManageChat () {
        return this.#fields.can_manage_chat;
    }

    get canChangeInfo () {
        return this.#fields.can_change_info;
    }

    get canDeleteMessages () {
        return this.#fields.can_delete_messages;
    }

    get canInviteUsers () {
        return this.#fields.can_invite_users;
    }

    get canRestrictMembers () {
        return this.#fields.can_restrict_members;
    }

    get canPinMessages () {
        return this.#fields.can_pin_messages;
    }

    get canManageTopics () {
        return this.#fields.can_manage_topics;
    }

    get canPromoteMembers () {
        return this.#fields.can_promote_members;
    }

    get canManageVideoChats () {
        return this.#fields.can_manage_video_chats;
    }

    get canPostStories () {
        return this.#fields.can_post_stories;
    }

    get canEditStories () {
        return this.#fields.can_edit_stories;
    }

    get canDeleteStories () {
        return this.#fields.can_delete_stories;
    }

    get isAnonymous () {
        return this.#fields.is_anonymous;
    }

    get canManageVoiceChats () {
        return this.#fields.can_manage_voice_chats;
    }

    // public
    updateTelegramBotGroupFields ( fields ) {
        for ( const field of FIELDS ) {
            if ( field in fields ) this.#fields[ field ] = fields[ field ];
        }
    }

    async setTelegramBotGroupFields ( fields ) {
        var updatedFields;

        for ( const field of FIELDS ) {
            if ( field in fields && this.#fields[ field ] !== fields[ field ] ) {
                updatedFields ??= {};

                updatedFields[ field ] = fields[ field ];
            }
        }

        if ( !updatedFields ) return result( 200 );

        updatedFields = {
            ...this.#fields,
            ...updatedFields,
        };

        const res = await this.dbh.do( sql`UPDATE telegram_bot_group`.SET( updatedFields ).sql`WHERE telegram_bot_id = ${ this.bot.id } AND telegram_group_id = ${ this.id }` );

        if ( res.ok ) this.#fields = updatedFields;

        return res;
    }

    toJSON () {
        const data = super.toJSON();

        return {
            ...data,
            ...this.#fields,
        };
    }
}
