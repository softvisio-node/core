import Mutex from "#lib/threads/mutex";
import sql from "#lib/sql";

const insertCallsInterval = 30_000;

const SQL = {
    "insertException": sql`INSERT INTO monitoring_method_exception ( monitoring_method_id, date, status, status_text, duration ) VALUES ( insert_monitoring_method( ?, ? ), ?, ?, ?, ? )`.prepare(),
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
            await this.#dbh.do( SQL.insertException, [component, method, start, res.status, res.statusText, duration] );
        }

        // trunkate date
        start.setMilliseconds( 0 );
        start.setSeconds( 0 );

        const key = component + "/" + method + "/" + start.getTime();

        const row = this.#apiCalls.get( key );

        if ( !row ) {
            this.#apiCalls.set( key, {
                "monitoring_method_id": sql`insert_monitoring_method( ${component}, ${method} )`,
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

            await this.#dbh.do( sql`
INSERT INTO monitoring_method_stats
`.VALUES( values, { "index": "firstRow" } ).sql`
ON CONFLICT ( monitoring_method_id, date ) DO UPDATE SET
    duration = monitoring_method_stats.duration + EXCLUDED.duration,
    calls = monitoring_method_stats.calls + EXCLUDED.calls,
    exceptions = monitoring_method_stats.exceptions + EXCLUDED.exceptions
` );

            if ( !this.isShuttingDown ) break;
        }

        mutex.unlock();
    }
}
