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

export default class TelegramBotRequest {
    #bot;
    #signal;
    #id;
    #type;
    #chatId;
    #data;

    constructor ( bot, signal, { id, type, "chat_id": chatId, data } = {} ) {
        this.#bot = bot;
        this.#signal = signal;
        this.#id = id;
        this.#type = UPDATE_TYPES[type];
        this.#chatId = chatId;
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

    get chatId () {
        return this.#chatId;
    }

    get isAborted () {
        return this.#signal.aborted;
    }

    get data () {
        return this.#data;
    }

    get from () {
        return this.#data.from;
    }

    get chat () {
        if ( this.isCallbackData ) {
            return this.#data.message.chat;
        }
        else {
            return this.#data.chat;
        }
    }

    isMessage () {
        return this.#type === "message";
    }

    get isEditedMessage () {
        return this.#type === "editedMessage";
    }

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

    get isCallbackQuery () {
        return this.#type === "callbackQuery";
    }

    get isShippingQuery () {
        return this.#type === "shippingQuery";
    }

    get isPreCheckoutQuery () {
        return this.#type === "preCheckoutQuery";
    }

    get isPoll () {
        return this.#type === "poll";
    }

    get isPollAnswer () {
        return this.#type === "pollAnswer";
    }

    get isMyChatMember () {
        return this.#type === "myChatMember";
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
