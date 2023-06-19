import sql from "#lib/sql";
import Counter from "#lib/threads/counter";
import AbortSignals from "#lib/abort-signals";
import Signal from "#lib/threads/signal";
import Events from "#lib/events";
import Mutex from "#lib/threads/mutex";

const DEFAULT_LINIT = 100;

const SQL = {
    "unlockUpdates": sql`UPDATE telegram_bot_update SET locked = FALSE WHERE telegram_bot_id = ?`,

    "getUpdates": sql`
WITH cte AS (
    SELECT id FROM telegram_bot_update WHERE telegram_bot_id = ? AND locked = FALSE ORDER BY update_id LIMIT ?
)
UPDATE
    telegram_bot_update
SET
    locked = TRUE
FROM
    cte
WHERE
    telegram_bot_update.id = cte.id
RETURNING
    telegram_bot_update.id,
    type,
    data
`.prepare(),

    "deleteUpdate": sql`DELETE FROM telegram_bot_update WHERE id = ?`.prepare(),
};

export default class TelegramBotProcessUpdates {
    #bot;
    #dbh;

    #start = false;
    #started = false;
    #abortController = new AbortController();
    #activityCounter = new Counter();
    #mutex;
    #chatMutexes = new Mutex.Set();
    #onTelegramUpdate;

    constructor ( bot, onTelegramUpdate ) {
        this.#bot = bot;
        this.#dbh = bot.dbh;
        this.#onTelegramUpdate = onTelegramUpdate;

        if ( this.#bot.app.cluster ) {
            this.#mutex = this.#bot.app.cluster.mutexes.get( "telegram/bot/process-updates/" + this.#bot.id );
        }
    }

    // properties
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

        const hasUpdatesSignal = new Signal(),
            events = new Events().link( this.#dbh ).on( `telegram/telegram-bot-update/${this.#bot.id}/create`, data => {
                hasUpdatesSignal.broadcast( data.chat_id );
            } );

        const signal = new AbortSignals();

        START: while ( true ) {
            signal.clear();
            signal.add( this.#abortController.signal );

            // aborted
            if ( signal.aborted ) break START;

            await this.#dbh.waitConnect( signal );
            if ( signal.aborted ) break START;
            signal.add( this.#dbh.abortSignal );

            // mutex
            if ( this.#mutex ) {

                // unlock mutex in case or repeat
                await this.#mutex.unlock();

                // lock mutex
                await this.#mutex.lock( { signal } );

                // aborted
                if ( signal.aborted ) break START;

                signal.add( this.#mutex.abortSignal );
            }

            // unlock updates
            const res = await this.#dbh.do( SQL.unlockUpdates, [this.id] );
            if ( !res.ok ) continue START;

            // aborted
            if ( signal.aborted ) continue START;

            // start updates cycle
            // start updates cycle
            GET_UPDATES: while ( true ) {

                // aborted
                if ( signal.aborted ) continue START;

                const updates = await this.#dbh.select( SQL.getUpdates, [this.#bot.id, DEFAULT_LINIT] );
                if ( !updates.ok ) continue START;

                // if no updates awailable - wait for event
                if ( !updates.data ) {
                    const chatId = await hasUpdatesSignal.wait( { signal } );

                    if ( chatId ) {

                        // XXX check, if can run new chat thread
                    }

                    continue GET_UPDATES;
                }

                for ( const update of updates.data ) {
                    this.#processUpdate( update, signal );
                }
            }
        }

        events.clear();
        signal.clear();

        // unlock mutex
        if ( this.#mutex ) await this.#mutex.unlock();

        // stop
        this.#started = false;

        this.#abortController = new AbortController();
        this.#activityCounter.value--;

        if ( this.#start ) this.#run();
    }

    async #processUpdate ( update, signal ) {
        const mutex = this.#chatMutexes.get( update.data.chat?.id || 0 );

        this.#activityCounter.value++;

        const updateId = update.id;

        ABORT: {
            await mutex.lock( signal );

            // aborted
            if ( signal.aborted ) break ABORT;

            await this.#onTelegramUpdate( update, signal );

            // delete update
            while ( true ) {
                if ( signal.aborted ) break;

                const res = await this.#dbh.do( SQL.deleteUpdate, [updateId] );

                if ( res.ok ) break;
            }

            mutex.unlock();
        }

        this.#activityCounter.value--;
    }
}
