import Message from "./request/message.js";

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
    #message;
    #command;
    #commandData;

    constructor ( bot, signal, { id, type, data } = {} ) {
        this.#bot = bot;
        this.#signal = signal;
        this.#id = id;
        this.#type = UPDATE_TYPES[ type ];
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

    get data () {
        return this.#data;
    }

    get type () {
        return this.#type;
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

    get from () {
        return this.#data.from;
    }

    get chat () {
        return this.message?.chat;
    }

    get message () {
        if ( this.#message === undefined ) {
            if ( this.isMessage ) {
                this.#message = new Message( this, this.#data );
            }
            else if ( this.isCallbackQuery ) {
                this.#message = new Message( this, this.#data.message );
            }
            else {
                this.#message = null;
            }
        }

        return this.#message;
    }

    get command () {
        if ( this.#command === undefined ) this.#parseCommand();

        return this.#command;
    }

    get commandData () {
        if ( this.#commandData === undefined ) this.#parseCommand();

        return this.#commandData;
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

    #parseCommand () {
        this.#command = null;
        this.#commandData = null;

        if ( this.isMessage && this.message.text?.startsWith( "/" ) ) {
            const match = this.message.text.match( /^\/([a-zA-Z0-9_]+)(.*)/ );

            this.#command = match?.[ 1 ].toLowerCase();

            this.#commandData = match?.[ 2 ].trim();
        }
    }
}
