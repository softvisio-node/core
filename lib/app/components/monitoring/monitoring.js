import Mutex from "#lib/threads/mutex";
import sql from "#lib/sql";

const insertCallsInterval = 30_000;

const SQL = {
    "logApiException": sql`INSERT INTO monitoring_exception ( component, method, date, status, status_text, duration ) VALUES ( ?, ?, ?, ?, ?, ? )`.prepare(),
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
        if ( !this.#enabled ) return result( 200 );

        var res;

        // migrate database
        res = await this.#dbh.schema.migrate( new URL( "db", import.meta.url ) );
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async run () {
        if ( !this.#enabled ) return result( 200 );

        setInterval( this.#insertCalls.bind( this ), insertCallsInterval );

        return result( 200 );
    }

    async shutDown () {
        return this.#insertCalls();
    }

    async monitorCall ( component, method, call ) {
        const start = new Date();

        try {
            var res = result.try( await call() );
        }
        catch ( e ) {
            res = result.catch( e, { "keepError": true } );
        }

        if ( !this.#enabled ) return res;

        const duration = Date.now() - start.getTime();

        // log api exception
        if ( res.isException ) {
            await this.dbh.do( SQL.logApiException, [component, method, start, res.status, res.statusText, duration] );
        }

        // trunkate date
        start.setMilliseconds( 0 );
        start.setSeconds( 0 );

        const key = component + "/" + method + "/" + start.getTime();

        const row = this.#apiCalls.get( key );

        if ( !row ) {
            this.#apiCalls.set( key, {
                component,
                method,
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

        return res;
    }

    // private
    async #insertCalls () {
        const mutex = this.#mutexSet.get( "insertCalls" );
        if ( !mutex.tryLock() ) return mutex.wait();

        while ( 1 ) {
            if ( !this.#apiCalls.size ) break;

            const values = [...this.#apiCalls.values()];
            this.#apiCalls = new Map();

            await this.dbh.do( sql`
INSERT INTO monitoring_calls
`.VALUES( values, { "index": "firstRow" } ).sql`
ON CONFLICT ( component, method, date ) DO UPDATE SET
    duration = api_health_calls.duration + EXCLUDED.duration,
    calls = api_health_calls.calls + EXCLUDED.calls,
    exceptions = api_health_calls.exceptions + EXCLUDED.exceptions
` );

            if ( !this.isShuttingDown ) break;
        }

        mutex.unlock();
    }
}
