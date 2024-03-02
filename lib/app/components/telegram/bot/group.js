import TelegramGroup from "../group.js";
import Chat from "./chat.js";
import sql from "#lib/sql";

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

        const res = await this.gbh.do( sql`UPDATE telegram_bot_group`.SET( updatedFields ).sql`WHERE id = ${ this.id } AND telegram_bot_id = ${ this.bot.id }` );

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

    // XXX ---------------------------------------------

    async hideGeneralForumTopic () {
        var res;

        res = await this.send( "hideGeneralForumTopic" );

        if ( !res.ok ) return res;

        return res;
    }

    async exportChatInviteLink () {
        return this.send( "exportChatInviteLink" );
    }

    async createChatInviteLink ( data ) {
        return this.send( "createChatInviteLink", data );
    }

    async createForumTopic ( name ) {
        return this.send( "createForumTopic", {
            name,
        } );
    }

    // XXX
    async approveChatJoinRequest () {}

    async setChatPhoto () {}

    async setChatPermissions () {}

    async getChat () {}

    async getChatMember ( userId ) {
        return this.send( "getChatMember", { "user_id": userId } );
    }

    async banChatMember ( userId ) {
        return this.send( "banChatMember", {
            "user_id": userId,
        } );
    }

    async unbanChatMember ( userId, { onlyIfBanned } = {} ) {
        return this.send( "unbanChatMember", {
            "user_id": userId,
            "only_if_banned": onlyIfBanned,
        } );
    }
}
