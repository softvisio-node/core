import Mutex from "#lib/threads/mutex";
import sql from "#lib/sql";

const insertApiCallsInterval = 30_000,
    updateLastUsedStatsInterval = 30_000;

const SQL = {
    "logApiException": sql`INSERT INTO api_health_exception ( method_id, date, status, status_text, duration ) VALUES ( ?, ?, ?, ?, ? )`.prepare(),
};

export default class {
    #frontend;
    #api;
    #dbh;
    #mutexes = new Mutex.Set();
    #apiCalls = new Map();
    #userTokenLastActivity = new Map();
    #userSessionLastActivity = new Map();

    constructor ( frontend ) {
        this.#frontend = frontend;
        this.#api = frontend.api;
        this.#dbh = frontend.api.dbh;
    }

    // propertied
    get api () {
        return this.#api;
    }

    get dbh () {
        return this.#dbh;
    }

    get isShuttingDown () {
        return this.#frontend.isShuttingDown;
    }

    // public
    async run () {
        setInterval( this.#insertApiCalls.bind( this ), insertApiCallsInterval );

        setInterval( this.#updateLastUsedStats.bind( this ), updateLastUsedStatsInterval );

        return result( 200 );
    }

    async shutDown () {
        await this.#insertApiCalls();

        await this.#updateLastUsedStats();
    }

    async logApiCall ( methodId, start, end, res ) {
        const duration = end.getTime() - start.getTime();

        // log api exception
        if ( res.isException ) {
            await this.dbh.do( SQL.logApiException, [methodId, start, res.status, res.statusText, duration] );
        }

        // trunkate date
        start.setMilliseconds( 0 );
        start.setSeconds( 0 );

        const key = methodId + "/" + start.getTime();

        const row = this.#apiCalls.get( key );

        if ( !row ) {
            this.#apiCalls.set( key, {
                "method_id": methodId,
                "date": start,
                "calls": 1,
                duration,
                "exceptions": res.isException ? 1 : 0,
            } );
        }
        else {
            row.calls++;
            row.duration += duration;
            if ( res.isException ) row.exceptions++;
        }
    }

    logTokenLastActivity ( token ) {
        if ( !token.id ) return;

        const lastActivity = new Date();

        if ( token.isUserToken ) {
            this.#userTokenLastActivity.set( token.id, {
                "id": token.id,
                "last_activity": lastActivity,
            } );
        }
        else if ( token.isUserSessionToken ) {
            this.#userSessionLastActivity.set( token.id, {
                "id": token.id,
                "last_activity": lastActivity,
                "expires": new Date( Date.now() + this.api.config.sessionMaxAge ),
            } );
        }
    }

    // private
    async #insertApiCalls () {
        const mutex = this.#mutexes.get( "insertApiCalls" );
        if ( !mutex.tryDown() ) return mutex.signal.wait();

        while ( 1 ) {
            if ( !this.#apiCalls.size ) break;

            const values = [...this.#apiCalls.values()];
            this.#apiCalls = new Map();

            await this.dbh.do( sql`
INSERT INTO api_health_calls
`.VALUES( values, { "index": "firstRow" } ).sql`
ON CONFLICT ( method_id, date ) DO UPDATE SET
    duration = api_health_calls.duration + EXCLUDED.duration,
    calls = api_health_calls.calls + EXCLUDED.calls,
    exceptions = api_health_calls.exceptions + EXCLUDED.exceptions
` );

            if ( !this.isShuttingDown ) break;
        }

        mutex.signal.broadcast();
        mutex.up();
    }

    async #updateLastUsedStats () {
        const mutex = this.#mutexes.get( "updateLastUsedStats" );
        if ( !mutex.tryDown() ) return mutex.signal.wait();

        while ( 1 ) {
            if ( !( this.#userTokenLastActivity.size || this.#userSessionLastActivity.size ) ) break;

            if ( this.#userTokenLastActivity.size ) {
                const values = [...this.#userTokenLastActivity.values()];
                this.#userTokenLastActivity = new Map();

                await this.dbh.do( sql`
UPDATE user_token SET
    last_activity = CASE
        WHEN t.last_activity::timestamptz <= user_token.last_activity THEN user_token.last_activity
        ELSE t.last_activity::timestamptz END
FROM`.VALUES_AS( "t", values, { "index": "firstRow" } ).sql`
WHERE user_token.id = t.id::int8
` );
            }

            if ( this.#userSessionLastActivity.size ) {
                const values = [...this.#userSessionLastActivity.values()];
                this.#userSessionLastActivity = new Map();

                await this.dbh.do( sql`
UPDATE user_session SET
    last_activity = CASE
        WHEN t.last_activity::timestamptz <= user_session.last_activity THEN user_session.last_activity
        ELSE t.last_activity::timestamptz END,
    expires = CASE
        WHEN t.expires::timestamptz <= user_session.expires THEN user_session.expires
        ELSE t.expires::timestamptz END
FROM`.VALUES_AS( "t", values, { "index": "firstRow" } ).sql`
WHERE user_session.id = t.id::int8
` );
            }

            if ( !this.isShuttingDown ) break;
        }

        mutex.signal.broadcast();
        mutex.up();
    }
}
