import CacheLru from "#lib/cache/lru";
import Mutex from "#lib/threads/mutex";
import sql from "#lib/sql";

const SQL = {
    "getTelegramGroupById": sql`
SELECT
    row_to_json( telegram_group ) AS telegram_group,
    row_to_json( telegram_bot_group ) AS telegram_bot_group
FROM
    telegram_group,
    telegram_bot_group
WHERE
    telegram_group.id = telegram_bot_group.telegram_group_id
    AND telegram_bot_group.telegram_bot_id = ?
    AND telegram_bot_group.telegram_group_id = ?
`.prepare(),
};

export default class TelegramBotGroups {
    #bot;
    #cache; // telegram id
    #mutexes = new Mutex.Set();

    constructor ( bot ) {
        this.#bot = bot;

        this.#cache = new CacheLru( { "maxSize": this.bot.config.telegram.groupsCacheMaxSize } );

        this.#bot.dbhEvents
            .on( "disconnect", () => this.clear.bind( this ) )
            .on( "telegram/telegram-group/update", data => {
                const group = this.#cache.get( data.id );

                group?.updateTelegramGroupFields( data );
            } )
            .on( `telegram/telegram-bot-group/${ this.bot.id }/update`, data => {
                const group = this.#cache.get( data.id );

                group?.updateTelegramBotGroupFields( data );
            } );
    }

    // properties
    get bot () {
        return this.#bot;
    }

    get app () {
        return this.bot.app;
    }

    get dbh () {
        return this.bot.dbh;
    }

    // public
    async getTelegramGroupById ( telegramGroupId, { dbh } = {} ) {
        var group = this.#cache.get( telegramGroupId );

        group ??= await this.#getGroup( "_getTelegramGroupById", telegramGroupId, dbh );

        return group;
    }

    clear () {
        this.#cache.clear( { "silent": true } );
    }

    // protected
    async _getTelegramGroupById ( dbh, telegramGroupId ) {
        return dbh.selectRow( SQL.getTelegramGroupById, [ this.#bot.id, telegramGroupId ] );
    }

    // private
    async #getGroup ( method, id, dbh ) {
        const mutex = this.#mutexes.get( method + "/" + id );

        if ( !mutex.tryLock() ) return mutex.wait();

        const res = await this[ method ]( dbh || this.dbh, id );

        if ( res.data ) {
            var group = new this.#bot.component.Group( this.#bot, res.data );

            this.#cacheGroup( group );
        }

        mutex.unlock( group );

        return group;
    }

    #cacheGroup ( group ) {
        if ( !group ) return;

        this.#cache.set( group.id, group );
    }
}
