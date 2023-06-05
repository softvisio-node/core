import Mutex from "#lib/threads/mutex";
import sql from "#lib/sql";

const updateLastUsedStatsInterval = 30_000;

export default class {
    #frontend;
    #api;
    #dbh;
    #mutex = new Mutex();
    #userTokenLastActivity = new Map();
    #userSessionLastActivity = new Map();
    #isShuttingDown = false;

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
        return this.#isShuttingDown;
    }

    // public
    async run () {
        setInterval( this.#updateLastUsedStats.bind( this ), updateLastUsedStatsInterval );

        return result( 200 );
    }

    async shutDown () {
        this.#isShuttingDown = true;

        await this.#updateLastUsedStats();
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
    async #updateLastUsedStats () {
        if ( !this.#mutex.tryLock() ) return this.#mutex.wait();

        while ( 1 ) {
            if ( !( this.#userTokenLastActivity.size || this.#userSessionLastActivity.size ) ) break;

            if ( this.#userTokenLastActivity.size ) {
                const values = [...this.#userTokenLastActivity.values()];
                this.#userTokenLastActivity = new Map();

                await this.dbh.do( sql`
UPDATE api_token SET
    last_activity = CASE
        WHEN t.last_activity::timestamptz <= api_token.last_activity THEN api_token.last_activity
        ELSE t.last_activity::timestamptz END
FROM`.VALUES_AS( "t", values, { "index": "firstRow" } ).sql`
WHERE api_token.id = t.id::int8
` );
            }

            if ( this.#userSessionLastActivity.size ) {
                const values = [...this.#userSessionLastActivity.values()];
                this.#userSessionLastActivity = new Map();

                await this.dbh.do( sql`
UPDATE api_session SET
    last_activity = CASE
        WHEN t.last_activity::timestamptz <= api_session.last_activity THEN api_session.last_activity
        ELSE t.last_activity::timestamptz END,
    expires = CASE
        WHEN t.expires::timestamptz <= api_session.expires THEN api_session.expires
        ELSE t.expires::timestamptz END
FROM`.VALUES_AS( "t", values, { "index": "firstRow" } ).sql`
WHERE api_session.id = t.id::int8
` );
            }

            if ( !this.isShuttingDown ) break;
        }

        this.#mutex.unlock();
    }
}
