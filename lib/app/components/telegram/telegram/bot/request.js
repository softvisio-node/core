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
    #data;
    #command;
    #commandData;
    #decodedCommandData;

    constructor ( bot, signal, { id, type, data } = {} ) {
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

    get id () {
        return this.#id;
    }

    get isAborted () {
        return this.#signal.aborted;
    }

    get type () {
        return this.#type;
    }

    get data () {
        return this.#data;
    }

    get from () {
        return this.#data.from;
    }

    get message () {
        if ( this.isCallbackQuery ) {
            return this.#data.message;
        }
        else if ( this.isInlineQuery || this.isChosenInlineResult ) {
            return null;
        }
        else {
            return this.#data;
        }
    }

    get chat () {
        return this.message?.chat;
    }

    get isMessage () {
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

    get command () {
        if ( this.#command === undefined ) this.#parseCommand();

        return this.#command;
    }

    get commandData () {
        if ( this.#commandData === undefined ) this.#parseCommand();

        return this.#commandData;
    }

    get decodedCommandData () {
        if ( this.#decodedCommandData === undefined ) {
            if ( this.commandData ) {
                this.#decodedCommandData = this.bot.telegram.decodeCallbackData( this.commandData );
            }
            else {
                this.#decodedCommandData = null;
            }
        }

        return this.#decodedCommandData;
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

    // private
    #parseCommand () {
        this.#command = null;
        this.#commandData = null;

        if ( this.isMessage && this.#data.text.startsWith( "/" ) ) {
            this.#command = this.#data.text;

            const idx = this.#command.indexOf( " " );

            if ( idx > 0 ) {
                this.#commandData = this.#command.substring( idx + 1 );

                this.#command = this.#command.substring( 0, idx );
            }

            if ( this.#command === "/" ) this.#command = "/start";
        }
    }
}
