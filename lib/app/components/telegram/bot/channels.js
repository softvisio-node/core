import CacheLru from "#lib/cache/lru";
import Mutex from "#lib/threads/mutex";
import sql from "#lib/sql";

const SQL = {
    "getTelegramChannelById": sql`
SELECT
    row_to_json( telegram_channel ) AS telegram_channel,
    row_to_json( telegram_bot_channel ) AS telegram_bot_channel
FROM
    telegram_channel,
    telegram_bot_channel
WHERE
    telegram_channel.id = telegram_bot_channel.telegram_channel_id
    AND telegram_bot_channel.telegram_bot_id = ?
    AND telegram_bot_channel.telegram_channel_id = ?
`.prepare(),
};

export default class TelegramBotChannels {
    #bot;
    #cache; // telegram id
    #mutexes = new Mutex.Set();

    constructor ( bot ) {
        this.#bot = bot;

        this.#cache = new CacheLru( { "maxSize": this.bot.config.telegram.channelsCacheMaxSize } );

        this.#bot.dbhEvents
            .on( "disconnect", () => this.clear.bind( this ) )
            .on( "telegram/telegram-channel/update", data => {
                const channel = this.#cache.get( data.id );

                channel?.updateTelegramChannelFields( data );
            } )
            .on( `telegram/telegram-bot-channel/${ this.bot.id }/update`, data => {
                const channel = this.#cache.get( data.id );

                channel?.updateTelegramBotChannelFields( data );
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
    async getTelegramChannelById ( telegramChannelId, { dbh } = {} ) {
        var channel = this.#cache.get( telegramChannelId );

        channel ??= await this.#getChannel( "_getTelegramChannelById", telegramChannelId, dbh );

        return channel;
    }

    clear () {
        this.#cache.clear( { "silent": true } );
    }

    // protected
    async _getTelegramChannelById ( dbh, telegramChannelId ) {
        return dbh.selectRow( SQL.getTelegramChannelById, [ this.#bot.id, telegramChannelId ] );
    }

    // private
    async #getChannel ( method, id, dbh ) {
        const mutex = this.#mutexes.get( method + "/" + id );

        if ( !mutex.tryLock() ) return mutex.wait();

        const res = await this[ method ]( dbh || this.dbh, id );

        if ( res.data ) {
            var channel = new this.#bot.component.Channel( this.#bot, res.data );

            this.#cacheChannel( channel );
        }

        mutex.unlock( channel );

        return channel;
    }

    #cacheChannel ( channel ) {
        if ( !channel ) return;

        this.#cache.set( channel.id, channel );
    }
}
