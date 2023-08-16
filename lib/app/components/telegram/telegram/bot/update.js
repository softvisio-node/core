const UPDATE_TYPES = {
    "message": "message",
    "edited_message": "editedMessage",
    "channel_post": "channelPost",
    "edited_channel_post": "editedChannelPost",
    "inline_query": "inlineQuery",
    "chosen_inline_result": "chosenInlineResult",
    "callback_query": "callbackQuery",
    "shipping_query": "shippingQuery",
    "pre_checkout_query": "preCheckoutQuery",
    "poll": "poll",
    "poll_answer": "pollAnswer",
    "my_chat_member": "myChatMember",
    "chat_member": "chatMember",
    "chat_join_request": "chatJoinRequest",
};

export default class TelegramBotUpdate {
    #bot;
    #id;
    #type;
    #data;

    constructor ( bot, { id, type, data } = {} ) {
        this.#bot = bot;
        this.#id = id;
        this.#type = UPDATE_TYPES[type];
        this.#data = data;
    }

    // properties
    get bot () {
        return this.#bot;
    }

    get id () {
        return this.#id;
    }

    get type () {
        return this.#type;
    }

    get data () {
        return this.#data;
    }

    get chatId () {
        return this.#data.chat?.id;
    }

    isMessage () {
        return this.#type === "message";
    }

    get isEditedMessage () {
        return this.#type === "editedMessage";
    }

    get isMychatMember () {
        return this.#type === "my_chat_member";
    }

    get isCallbackQuery () {
        return this.#type === "callbackQuery";
    }

    // XXX
    get isChannelPost () {
        return this.#type === "channelPost";
    }

    get isEditedChannelPost () {
        return this.#type === "editedChannelPost";
    }

    get isInlineQuery () {
        return this.#type === "inlineQuery";
    }

    get isChosenInlineResult () {
        return this.#type === "chosenInlineResult";
    }

    get isPoll () {
        return this.#type === "poll";
    }

    get isShippingQuery () {
        return this.#type === "shippingQuery";
    }

    get isPreCheckoutQuery () {
        return this.#type === "preCheckoutQuery";
    }

    get isPollAnswer () {
        return this.#type === "pollAnswer";
    }

    get isChatMember () {
        return this.#type === "chatMember";
    }

    get isChatJoinRequest () {
        return this.#type === "chatJoinRequest";
    }

    // public
    toString () {
        return JSON.stringify(
            {
                "type": this.#type,
                "data": this.#data,
            },
            null,
            4
        );
    }
}
