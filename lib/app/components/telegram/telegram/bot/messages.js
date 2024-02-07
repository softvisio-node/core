import sql from "#lib/sql";
import TelegramBotMessage from "./message.js";
import CacheLru from "#lib/cache/lru";
import Mutex from "#lib/threads/mutex";
import Events from "#lib/events";

const SQL = {
    "getById": sql`SELECT data FROM telegram_bot_message WHERE id = ? AND telegram_bot_id = ?`.prepare(),
};

export default class {
    #bot;
    #cache;
    #dbhEvents;
    #mutexes = new Mutex.Set();

    constructor ( bot ) {
        this.#bot = bot;

        this.#cache = new CacheLru( { "maxSize": this.bot.config.telegram.messagesCacheMaxSize } );

        this.#dbhEvents = new Events()
            .link( this.dbh )
            .on( "disconnect", () => this.clear.bind( this ) )
            .on( "telegram/telegram-bot-message/${ this.bot.id }/delete", data => {
                this.#cache.delete( data.id );
            } );
    }

    // properties
    get bot () {
        return this.#bot;
    }

    get dbh () {
        return this.#bot.dbh;
    }

    // public
    shutDown () {
        this.#dbhEvents.clear();
    }

    async getMessageById ( id, { dbh } = {} ) {
        dbh ||= this.#bot.dbh;

        const res = await dbh.selectRow( SQL.getById, [ id, this.#bot.id ] );

        if ( !res.ok ) return false;

        if ( !res.data ) return;

        return new TelegramBotMessage( this.#bot, { id, ...( res.data.data || {} ) } );
    }

    clear () {
        this.#cache.clear( { "silent": true } );
    }
}
