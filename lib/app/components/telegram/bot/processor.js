import sql from "#lib/sql";
import Counter from "#lib/threads/counter";
import Signal from "#lib/threads/signal";
import Events from "#lib/events";
import Mutex from "#lib/threads/mutex";
import TelegramBotRequest from "./request.js";

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

export default class TelegramBotProcessor {
    #bot;
    #start = false;
    #started = false;
    #abortController = new AbortController();
    #activityCounter = new Counter();
    #mutex;
    #chatMutexes = new Mutex.Set();
    #onTelegramUpdate;

    constructor ( bot, onTelegramUpdate ) {
        this.#bot = bot;
        this.#onTelegramUpdate = onTelegramUpdate;

        if ( this.bot.app.cluster ) {
            this.#mutex = this.bot.app.cluster.mutexes.get( "telegram/bot/process-updates/" + this.bot.id );
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
    start () {
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
            events = new Events().link( this.dbh ).on( `telegram/telegram-bot-update/${ this.bot.id }/create`, data => {
                hasUpdatesSignal.broadcast( data.chat_id );
            } );

        START: while ( true ) {
            let signal = this.#abortController.signal;

            // aborted
            if ( signal.aborted ) break START;

            await this.dbh.waitConnect( signal );
            if ( signal.aborted ) break START;

            signal = AbortSignal.any( [ signal, this.dbh.abortSignal ] );

            // mutex
            if ( this.#mutex ) {

                // unlock mutex in case or repeat
                await this.#mutex.unlock();

                // lock mutex
                await this.#mutex.lock( { signal } );

                // aborted
                if ( signal.aborted ) break START;

                signal = AbortSignal.any( [ signal, this.#mutex.abortSignal ] );
            }

            // unlock updates
            const res = await this.dbh.do( SQL.unlockUpdates, [ this.id ] );
            if ( !res.ok ) continue START;

            // clear users cache, because user state is not symc
            this.bot.users.clear();

            // start updates cycle
            GET_UPDATES: while ( true ) {

                // aborted
                if ( signal.aborted ) continue START;

                const updates = await this.dbh.select( SQL.getUpdates, [ this.bot.id, DEFAULT_LINIT ] );
                if ( !updates.ok ) continue START;

                // if no updates awailable - wait for event
                if ( !updates.data ) {
                    const chatId = await hasUpdatesSignal.wait( { signal } );

                    if ( chatId ) {

                        // XXX check, if can start new chat thread
                    }

                    continue GET_UPDATES;
                }

                for ( const update of updates.data ) {
                    this.#processUpdate( update, signal );
                }
            }
        }

        events.clear();

        // unlock mutex
        if ( this.#mutex ) await this.#mutex.unlock();

        // stop
        this.#started = false;

        this.#abortController = new AbortController();
        this.#activityCounter.value--;

        if ( this.#start ) this.#run();
    }

    async #processUpdate ( update, signal ) {
        const req = new TelegramBotRequest( this.bot, signal, update );

        const mutex = this.#chatMutexes.get( req.chat?.id ?? -1 );

        this.#activityCounter.value++;

        ABORT: {
            await mutex.lock( signal );

            // aborted
            if ( signal.aborted ) break ABORT;

            try {
                await this.#onTelegramUpdate( req );
            }
            catch ( e ) {
                console.log( `Telegram error:`, e );
            }

            // delete update
            while ( true ) {
                if ( signal.aborted ) break;

                const res = await this.dbh.do( SQL.deleteUpdate, [ req.id ] );

                if ( res.ok ) break;
            }

            mutex.unlock();
        }

        this.#activityCounter.value--;
    }
}
