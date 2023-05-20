export default class TelegramBotUpdate {
    #bot;
    #id;
    #type;
    #data;
    #update;

    constructor ( bot, update ) {
        this.#bot = bot;
        this.#id = update.update_id;
        delete update.update_id;
        this.#type = Object.keys( update )[0];
        this.#data = update[this.#type];
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
