import TelegramChannel from "../channel.js";

const FIELDS = [

    //
    "status",
    "can_be_edited",
    "can_manage_chat",
    "can_change_info",
    "can_post_messages",
    "can_edit_messages",
    "can_delete_messages",
    "can_invite_users",
    "can_restrict_members",
    "can_promote_members",
    "can_manage_video_chats",
    "can_post_stories",
    "can_edit_stories",
    "can_delete_stories",
    "is_anonymous",
    "can_manage_voice_chats",
];

// import sql from "#lib/sql";

// const SQL = {
//     "setSubscribed": sql`UPDATE telegram_bot_user SET subscribed = ? WHERE id = ?`.prepare(),

//     "setBanned": sql`UPDATE telegram_bot_user SET banned = ? WHERE id = ?`.prepare(),

//     "setState": sql`UPDATE telegram_bot_user SET state = ? WHERE id = ?`.prepare(),

//     "setLocale": sql`UPDATE telegram_bot_user SET locale = ? WHERE id = ?`.prepare(),
// };

export default class TelegramBotChannel extends TelegramChannel {
    #bot;
    #id;
    #fields = {};

    constructor ( bot, data ) {
        super( bot.telegram, data );

        this.#bot = bot;

        const fields = data.telegram_bot_channel;

        this.#id = fields.id;

        this.updateTelegramBotChannelFields( fields );
    }

    // properties
    get bot () {
        return this.#bot;
    }

    get app () {
        return this.#bot.app;
    }

    get id () {
        return this.#id;
    }

    get telegramId () {
        return super.id;
    }

    // XXX -------------------------------------------

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

    get canPostMessages () {
        return this.#fields.can_post_messages;
    }

    get canEditMessages () {
        return this.#fields.can_edit_messages;
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
    updateTelegramBotChannelFields ( fields ) {
        for ( const field of FIELDS ) {
            if ( field in fields ) this.#fields[ field ] = fields[ field ];
        }
    }

    // XXX
    async setTelegramBotChannelFields ( fields ) {}

    toJSON () {
        const data = super.toJSON();

        data.telegram_id = data.id;

        data.id = this.#id;

        return {
            ...data,
            ...this.#fields,
        };
    }
}
