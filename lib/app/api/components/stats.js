import Component from "#lib/app/api/component";
import Mutex from "#lib/threads/mutex";
import sql from "#lib/sql";

const insertApiCallsInterval = 30_000,
    updateLastUsedStatsInterval = 30_000;

const SQL = {
    "logApiException": sql`INSERT INTO health_api_exception ( method_id, date, status, status_text, duration ) VALUES ( ?, ?, ?, ?, ? )`.prepare(),
};

export default class extends Component {
    #mutexes = new Mutex.Set( { "destroyOnFinish": true } );
    #apiCalls = new Map();
    #userTokenLastActivity = new Map();
    #userSessionLastActivity = new Map();

    // public
    async logApiCall ( methodId, date, res ) {
        const duration = Date.now() - date.getTime();

        // log api exception
        if ( res.exception ) {
            await this.dbh.do( SQL.logApiException, [methodId, date, res.status, res.statusText, duration] );
        }

        // trunkate date
        date.setMilliseconds( 0 );
        date.setSeconds( 0 );

        const key = methodId + "/" + date.getTime();

        const row = this.#apiCalls.get( key );

        if ( !row ) {
            this.#apiCalls.set( key, {
                "method_id": methodId,
                date,
                duration,
                "call_count": 1,
            } );
        }
        else {
            row.duration += duration;
            row.call_count++;
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

    // protected
    async _init () {
        setInterval( this.#insertApiCalls.bind( this ), insertApiCallsInterval );

        setInterval( this.#updateLastUsedStats.bind( this ), updateLastUsedStatsInterval );

        return result( 200 );
    }

    async _shutDown () {
        await this.#insertApiCalls();

        await this.#updateLastUsedStats();
    }

    // private
    async #insertApiCalls () {
        const mutex = this.#mutexes.get( "insertApiCalls" );
        if ( !mutex.tryDown() ) return mutex.signal.wait();

        while ( 1 ) {
            if ( !this.#apiCalls.size ) break;

            const values = this.#apiCalls.values();
            this.#apiCalls = new Map();

            await this.dbh.do( sql`
INSERT INTO health_api_call
`.VALUES( values ).sql`
ON CONFLICT ( method_id, date ) DO UPDATE SET
    duration = duration + EXCLUDED.duration,
    call_count = call_count + EXCLUDED.call_count
` );

            if ( !this.isShuttingDown ) break;
        }

        mutex.signal.broadcast();
        mutex.up();
    }

    // XXX
    async #updateLastUsedStats () {
        const mutex = this.#mutexes.get( "updateLastUsedStats" );
        if ( !mutex.tryDown() ) return mutex.signal.wait();

        while ( 1 ) {
            if ( !this.#userTokenLastActivity.size && this.#userSessionLastActivity.size ) break;

            if ( this.#userTokenLastActivity.size ) {

                // const values = this.#userTokenLastActivity;
                // this.#userTokenLastActivity = new Map();

                await this.dbh.do( sql`
UPDATE user_token SET
    last_activity = CASE WHEN t.last_activity > last_activity THEN t.last_activity ELSE last_activity END
FROM ( ( ?, ? ), ( ?, ? ) ) AS t ( last_activiry, id )
WHERE user_token.id = t.id
` );
            }

            if ( this.#userSessionLastActivity.size ) {

                // const values = this.#userSessionLastActivity;
                // this.#userSessionLastActivity = new Map();

                await this.dbh.do( sql`
UPDATE user_session SET
    last_activity = CASE WHEN t.last_activity > last_activity THEN t.last_activity ELSE last_activity END,
    expires = CASE WHEN t.expires > expires THEN t.expires ELSE expires END
FROM ( ( ?, ? ), ( ?, ? ) ) AS t ( last_activiry, expires, id )
WHERE user_token.id = t.id
` );
            }

            if ( !this.isShuttingDown ) break;
        }

        mutex.signal.broadcast();
        mutex.up();
    }
}
