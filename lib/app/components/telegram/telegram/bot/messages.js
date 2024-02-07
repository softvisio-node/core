import sql from "#lib/sql";
import TelegramBotMessage from "./message.js";

const SQL = {
    "getById": sql`SELECT data FROM telegram_bot_message WHERE id = ? AND telegram_bot_id = ?`.prepare(),
};

export default class {
    #bot;

    cpnstructor ( bot ) {
        this.#bot = bot;
    }

    // properties
    get bot () {
        return this.#bot;
    }

    get dbh () {
        return this.#bot.dbh;
    }

    // public
    shutDown () {}

    async getMessageById ( id, { dbh } = {} ) {
        dbh ||= this.#bot.dbh;

        const res = await dbh.selectRow( SQL.getById, [ id, this.#bot.id ] );

        if ( !res.ok ) return false;

        if ( !res.data ) return;

        return new TelegramBotMessage( this.#bot, { id, ...( res.data.data || {} ) } );
    }
}
