import Mutex from "#lib/threads/mutex";
import sql from "#lib/sql";

const insertCallsInterval = 30_000;

const SQL = {
    "logApiException": sql`INSERT INTO api_health_exception ( method_id, date, status, status_text, duration ) VALUES ( ?, ?, ?, ?, ? )`.prepare(),
};

export default class Monitoring {
    #app;
    #config;
    #dbh;
    #enabled;
    #mutexSet = new Mutex.Set();
    #apiCalls = new Map();

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;

        this.#dbh = this.#app.dbh;
        this.#enabled = this.#config.enabled && this.#dbh;
    }

    // publuc
    async init () {
        var res;

        // migrate database
        res = await this.#dbh.schema.migrate( new URL( "db", import.meta.url ) );
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async run () {
        setInterval( this.#insertCalls.bind( this ), insertCallsInterval );
    }

    async shutDown () {}

    async dropCache () {
        await this.#insertCalls();
    }

    async monitorCall ( component, method, call ) {
        return await call();
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

    // private
    async #insertCalls () {
        const mutex = this.#mutexSet.get( "insertApiCalls" );
        if ( !mutex.tryLock() ) return mutex.wait();

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

        mutex.unlock();
    }
}
