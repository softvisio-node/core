import Component from "#lib/app/api/component";
import Mutex from "#lib/threads/mutex";
import sql from "#lib/sql";

const SQL = {
    "logApiException": sql`INSERT INTO health_api_exception ( method_id, date, status, status_text, duration ) VALUES ( ?, ?, ?, ?, ? )`.prepare(),
};

export default class extends Component {
    #stat = {}; // XXX ???
    #apiCalls = new Map();

    #userTokenLastActivity = new Map();
    #userSessionLastActivity = new Map();
    #mutexes = new Mutex.Set( { "destroyOnFinish": true } );

    // properties
    get stat () {
        return this.#stat;
    }

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

        this.#insertApiCalls();
    }

    logTokenLastActivity ( token ) {
        if ( !token.id ) return;

        const lastActivity = new Date();

        if ( token.isUserToken ) {
            this.#userTokenLastActivity.set( token.id, `UPDATE user_token SET last_activity = '${lastActivity.toISOString()}' WHERE id = ${token.id};` );
        }
        else if ( token.isUserSessionToken ) {
            const expires = new Date( Date.now() + this.api.config.sessionMaxAge );

            this.#userSessionLastActivity.set( token.id, `UPDATE user_session SET last_activity = '${lastActivity.toISOString()}', expires = '${expires.toISOString()}' WHERE id = ${token.id};` );
        }
    }

    // protected
    async _init () {
        setInterval( this.#insertApiCalls.bind( this, true ), this.api.config.apiCallLogCacheDropInterval );

        setInterval( this.#dropLastUsedStats.bind( this ), this.api.config.lastActivityCacheDropInterval );

        return result( 200 );
    }

    async _shutDown () {
        await this.#insertApiCalls( true );

        await this.#dropLastUsedStats();
    }

    // private
    async #insertApiCalls ( force ) {
        if ( !force && !this.#apiCalls.size ) return;

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

    async #dropLastUsedStats () {
        const mutex = this.#mutexes.get( "userStats" );

        if ( !mutex.tryDown() ) return mutex.signal.wait();

        const sql = [];

        if ( this.#userTokenLastActivity.size ) {
            sql.push( ...this.#userTokenLastActivity.values() );
            this.#userTokenLastActivity.clear();
        }

        if ( this.#userSessionLastActivity.size ) {
            sql.push( ...this.#userSessionLastActivity.values() );
            this.#userSessionLastActivity.clear();
        }

        if ( sql.length ) {
            await this.dbh.exec( sql.join( " " ) );
        }

        mutex.signal.broadcast();
        mutex.up();
    }
}
