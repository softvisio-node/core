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
    #signal;
    #user;
    #id;
    #type;
    #data;
    #isMessage;

    constructor ( bot, signal, { id, type, data } ) {
        this.#bot = bot;
        this.#signal = signal;
        this.#id = id;
        this.#type = UPDATE_TYPES[type];
        this.#data = data;
    }

    // properties
    get bot () {
        return this.#bot;
    }

    get abortSignal () {
        return this.#signal;
    }

    get user () {
        return this.#user;
    }

    set user ( user ) {
        this.#user = user;
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

    get messageId () {
        return this.#data.message_id;
    }

    get date () {
        return this.#data.date;
    }

    get text () {
        return this.#data.text;
    }

    isMessage () {
        return ( this.#isMessage ??= this.#type === "message" );
    }

    get isMychatMember () {
        return this.#type === "my_chat_member";
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
