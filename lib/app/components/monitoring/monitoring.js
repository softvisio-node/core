import Mutex from "#lib/threads/mutex";
import sql from "#lib/sql";
import Monitoring from "#lib/devel/monitoring";

const insertCallsInterval = 30_000,
    monitorInstanceInterval = 30_000;

const SQL = {
    "insertException": sql`INSERT INTO monitoring_method_exception ( monitoring_method_id, date, status, status_text, duration ) VALUES ( insert_monitoring_method( ?, ?, ? ), ?, ?, ?, ? )`.prepare(),

    "monitorInstance": sql`
INSERT INTO
    monitoring_instance_stats
    (
        monitoring_instance_id,
        date,
        cpu_user_delta,
        cpu_system_delta,
        memory_used,
        memory_delta,
        fs_total,
        fs_free,
        fs_free_delta
    )
    VALUES
    (
        insert_monitoring_instance( ?, ?, ?, ? ),
        ?, ?, ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT ( monitoring_instance_id, date ) DO UPDATE SET
        cpu_user_delta = monitoring_instance_stats.cpu_user_delta + EXCLUDED.cpu_user_delta,
        cpu_system_delta = monitoring_instance_stats.cpu_system_delta + EXCLUDED.cpu_system_delta,
        memory_used = EXCLUDED.memory_used,
        memory_delta = monitoring_instance_stats.memory_delta + EXCLUDED.memory_delta,
        fs_total = EXCLUDED.fs_total,
        fs_free = EXCLUDED.fs_free,
        fs_free_delta = monitoring_instance_stats.fs_free_delta + EXCLUDED.fs_free_delta
`.prepare(),
};

export default class {
    #app;
    #config;
    #dbh;
    #enabled;
    #mutexSet = new Mutex.Set();
    #apiCalls = new Map();
    #instanceMonitoring;

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

        this.#instanceMonitoring = new Monitoring( { "cpu": true, "memory": true, "fs": true } );

        setInterval( this.#monitorInstance.bind( this ), monitorInstanceInterval );

        return result( 200 );
    }

    async shutDown () {
        return this.#insertCalls();
    }

    async monitorMethodCall ( component, method, call ) {
        const monitoring = new Monitoring();

        try {
            var res = result.try( await call() );
        }
        catch ( e ) {
            res = result.catch( e, { "keepError": true } );
        }

        if ( !this.#enabled ) return res;

        const mark = monitoring.mark();

        const start = mark.start,
            duration = mark.duration;

        // log api exception
        if ( res.isException ) {
            await this.#dbh.do( SQL.insertException, [

                //
                this.#app.id.packageName,
                component,
                method,

                start,
                res.status,
                res.statusText,
                duration,
            ] );
        }

        // trunkate date
        start.setMilliseconds( 0 );
        start.setSeconds( 0 );

        const key = component + "/" + method + "/" + start.getTime();

        const row = this.#apiCalls.get( key );

        if ( !row ) {
            this.#apiCalls.set( key, {
                "monitoring_method_id": sql`insert_monitoring_method( ${this.#app.id.packageName}, ${component}, ${method} )`,
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

    async #monitorInstance () {
        const mark = this.#instanceMonitoring.mark();

        const date = mark.start;
        date.setMilliseconds( 0 );
        date.setSeconds( 0 );

        return this.#dbh.do( SQL.monitorInstance, [

            //
            this.#app.id.clusterId,
            this.#app.id.packageName,
            this.#app.id.serviceName,
            this.#app.id.instanceId,

            date,

            mark.cpuUserDelta,
            mark.cpuSystemDelta,

            mark.memory,
            mark.memoryDelta,

            mark.fsTotal,
            mark.fsFree,
            mark.fsFreeDelta,
        ] );
    }
}
