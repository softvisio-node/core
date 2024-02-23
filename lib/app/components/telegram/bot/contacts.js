import sql from "#lib/sql";
import TelegramBotContact from "./contact.js";
import CacheLru from "#lib/cache/lru";
import Mutex from "#lib/threads/mutex";

const SQL = {
    "getById": sql`SELECT * FROM telegram_bot_contact WHERE id = ? AND telegram_bot_id = ?`.prepare(),
};

export default class {
    #bot;
    #cache;
    #mutexes = new Mutex.Set();

    constructor ( bot ) {
        this.#bot = bot;

        this.#cache = new CacheLru( { "maxSize": this.bot.config.telegram.contactsCacheMaxSize } );

        this.#bot.dbhEvents
            .on( "disconnect", () => this.clear.bind( this ) )
            .on( `telegram/telegram-bot-contact/${ this.bot.id }/update`, data => {
                const contact = this.#cache.get( data.id );

                contact?.updateFields( data.data );
            } )
            .on( `telegram/telegram-bot-contact/${ this.bot.id }/delete`, data => {
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
    async createContact ( { dbh } = {} ) {
        const res = await TelegramBotContact.create( dbh || this.dbh, this.#bot.id );

        if ( !res.ok ) throw res;

        return new TelegramBotContact( this, res.data.id );
    }

    async getContact ( id, { dbh } = {} ) {
        var contact = this.#cache.get( id );

        if ( contact ) return contact;

        const mutex = this.#mutexes.get( id );

        if ( !mutex.tryLock() ) return mutex.wait();

        dbh ||= this.#bot.dbh;

        try {
            const res = await dbh.selectRow( SQL.getById, [ id, this.#bot.id ] );

            if ( !res.ok ) throw false;

            if ( !res.data ) throw null;

            contact = new TelegramBotContact( this, id, res.data );

            this.#cache.set( id, contact );
        }
        catch ( e ) {
            contact = e;
        }

        mutex.unlock( contact );

        return contact;
    }

    clear () {
        this.#cache.clear( { "silent": true } );
    }
}
