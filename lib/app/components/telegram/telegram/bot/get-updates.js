import sql from "#lib/sql";
import Counter from "#lib/threads/counter";

const DEFAULT_GET_UPDATES_TIMEOUT = 60; // seconds, 1 minute

const SQL = {
    "getTelegramLastUpdateId": sql`SELECT telegram_last_update_id FROM telegram_bot WHERE id = ?`.prepare(),
};

export default class TelegramBotGetUpdates {
    #bot;
    #start = false;
    #started = false;
    #abortController = new AbortController();
    #activityCounter = new Counter();
    #mutex;
    #telegramLastUpdateId;

    constructor ( bot ) {
        this.#bot = bot;

        if ( this.bot.app.cluster ) {
            this.#mutex = this.bot.app.cluster.mutexes.get( "telegram/bot/get-updates/" + this.bot.id );
        }
    }

    // properties
    get bot () {
        return this.#bot;
    }

    get dbh () {
        return this.#bot.dbh;
    }

    get isStarted () {
        return this.#started;
    }

    // public
    start ( sugnal ) {
        this.#start = true;

        this.#run();
    }

    async stop () {
        this.#start = false;

        if ( !this.#started ) return;

        this.#abortController.abort();

        return this.#activityCounter.wait();
    }

    // private
    async #run () {
        if ( !this.#start ) return;

        if ( this.#started ) return;
        this.#started = true;

        this.#activityCounter.value++;

        START: while ( true ) {
            let signal = this.#abortController.signal;

            // aborted
            if ( signal.aborted ) break START;

            // mutex
            if ( this.#mutex ) {

                // unlock mutex in case or repeat
                await this.#mutex.unlock();

                // lock mutex
                await this.#mutex.lock( { signal } );

                // aborted
                if ( signal.aborted ) break START;

                signal = AbortSignal.any( [signal, this.#mutex.abortSignal] );
            }

            let res = await this.bot.updateTelegramData();
            if ( !res.ok ) {

                // api key is invalid
                if ( res.status === 401 ) {
                    await this.bot.setStarted( false, { "error": "API key is not valid" } );
                    break START;
                }

                // some other error, restart
                else {
                    continue START;
                }
            }

            res = await this.dbh.selectRow( SQL.getTelegramLastUpdateId, [this.bot.id] );
            if ( !res.ok ) continue START;

            this.#telegramLastUpdateId = res.data.telegram_last_update_id || -1;

            // aborted
            if ( signal.aborted ) continue START;

            // start updates cycle
            GET_UPDATES: while ( true ) {

                // aborted
                if ( signal.aborted ) continue START;

                const updates = await this.bot.telegramBotApi.getUpdates( {
                    "offset": this.#telegramLastUpdateId + 1,
                    "timeout": DEFAULT_GET_UPDATES_TIMEOUT,
                    "allowedUpdates": null,
                    signal,
                } );

                // get updates error
                if ( !updates.ok ) continue START;

                // no updates received
                if ( !updates.data?.length ) continue GET_UPDATES;

                let telegramLastUpdateId = this.#telegramLastUpdateId;

                const res = await this.dbh.do( sql`INSERT INTO telegram_bot_update`.VALUES( updates.data.map( update => {
                    const updateId = update.update_id;
                    delete update.update_id;

                    telegramLastUpdateId = updateId;

                    const type = Object.keys( update )[0];

                    return {
                        "telegram_bot_id": this.bot.id,
                        "update_id": updateId,
                        "chat_id": update[type].chat.id,
                        type,
                        "data": update[type],
                    };
                } ) ) );

                if ( res.ok ) {
                    this.#telegramLastUpdateId = telegramLastUpdateId;
                }
            }
        }

        // unlock mutex
        if ( this.#mutex ) await this.#mutex.unlock();

        // stop
        this.#started = false;

        this.#abortController = new AbortController();
        this.#activityCounter.value--;

        if ( this.#start ) this.#run();
    }
}
