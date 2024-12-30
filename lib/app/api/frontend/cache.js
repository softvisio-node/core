import Interval from "#lib/interval";
import sql from "#lib/sql";
import Mutex from "#lib/threads/mutex";

const updateLastUsedStatsInterval = 30_000;

export default class {
    #api;
    #dbh;
    #mutex = new Mutex();
    #userTokenLastActivity = new Map();
    #userSessionLastActivity = new Map();
    #isDestroying = false;
    #sessionMaxAge;

    constructor ( frontend ) {
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

    get isDestroying () {
        return this.#isDestroying;
    }

    // public
    async start () {
        setInterval( this.#updateLastUsedStats.bind( this ), updateLastUsedStatsInterval );

        return result( 200 );
    }

    async destroy () {
        this.#isDestroying = true;

        await this.#updateLastUsedStats();
    }

    updateTokenLastActivity ( token ) {
        if ( !token.id ) return;

        const lastActivity = new Date();

        if ( token.isApiToken ) {
            this.#userTokenLastActivity.set( token.id, {
                "id": token.id,
                "last_activity": lastActivity,
            } );
        }
        else if ( token.isSessionToken ) {
            this.#sessionMaxAge ??= new Interval( this.api.config.sessionMaxAge );

            this.#userSessionLastActivity.set( token.id, {
                "id": token.id,
                "last_activity": lastActivity,
                "expires": this.#sessionMaxAge.addDate(),
            } );
        }
    }

    // private
    async #updateLastUsedStats () {
        if ( !this.#mutex.tryLock() ) return this.#mutex.wait();

        while ( true ) {
            if ( !( this.#userTokenLastActivity.size || this.#userSessionLastActivity.size ) ) break;

            if ( this.#userTokenLastActivity.size ) {
                const values = [ ...this.#userTokenLastActivity.values() ];
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
                const values = [ ...this.#userSessionLastActivity.values() ];
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

            if ( !this.isDestroying ) break;
        }

        this.#mutex.unlock();
    }
}
