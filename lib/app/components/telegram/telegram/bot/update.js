export default class TelegramBotUpdate {
    #bot;
    #user;
    #id;
    #type;
    #data;

    constructor ( bot, user, { id, type, data } ) {
        this.#bot = bot;
        this.#user = user;
        this.#id = id;
        this.#type = type;
        this.#data = data;
    }

    // properties
    get bot () {
        return this.#bot;
    }

    get user () {
        return this.#user;
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
}
