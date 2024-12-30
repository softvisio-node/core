import Monitoring from "#lib/devel/monitoring";
import sql from "#lib/sql";
import Mutex from "#lib/threads/mutex";

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
        cpu_used,
        ram_used,
        ram_used_percent,
        rss_used,
        rss_used_percent,
        hdd_used,
        hdd_used_percent
    )
    VALUES
    (
        insert_monitoring_instance( ?, ?, ?, ?, ? ),
        ?, ?, ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT ( monitoring_instance_id, date ) DO UPDATE SET
        cpu_used = greatest( monitoring_instance_stats.cpu_used, EXCLUDED.cpu_used ),
        ram_used = greatest( monitoring_instance_stats.ram_used, EXCLUDED.ram_used ),
        ram_used_percent = greatest( monitoring_instance_stats.ram_used_percent, EXCLUDED.ram_used_percent ),
        rss_used = greatest( monitoring_instance_stats.rss_used, EXCLUDED.rss_used ),
        rss_used_percent = greatest( monitoring_instance_stats.rss_used_percent, EXCLUDED.rss_used_percent ),
        hdd_used = greatest( monitoring_instance_stats.hdd_used, EXCLUDED.hdd_used ),
        hdd_used_percent = greatest( monitoring_instance_stats.hdd_used_percent, EXCLUDED.hdd_used_percent )
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
    #isDestroying = false;

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

    async start () {
        if ( !this.#enabled ) return result( 200 );

        setInterval( this.#insertCalls.bind( this ), insertCallsInterval );

        this.#instanceMonitoring = new Monitoring( {
            "cpu": true,
            "ram": true,
            "hdd": true,
            "hddPath": this.#app.env.dataDir,
        } );

        setInterval( this.#monitorInstance.bind( this ), monitorInstanceInterval );

        return result( 200 );
    }

    async destroy () {
        this.#isDestroying = true;

        return this.#insertCalls();
    }

    async monitorMethodCall ( component, method, call ) {
        if ( this.#enabled ) {
            var monitoring = new Monitoring();
        }

        try {
            var res = result.try( await call() );
        }
        catch ( e ) {
            res = result.catch( e );
        }

        if ( !this.#enabled ) return res;

        const mark = monitoring.markSync();

        const start = mark.startDate,
            duration = mark.duration;

        // log api exception
        if ( res.isException ) {
            await this.#dbh.do( SQL.insertException, [

                //
                this.#app.env.packageName,
                component,
                method,

                start,
                res.status,
                res.statusText,
                duration,
            ] );
        }

        // truncate date
        start.setMilliseconds( 0 );
        start.setSeconds( 0 );

        const key = component + "/" + method + "/" + start.getTime();

        const row = this.#apiCalls.get( key );

        if ( !row ) {
            this.#apiCalls.set( key, {
                "monitoring_method_id": sql`insert_monitoring_method( ${ this.#app.env.packageName }, ${ component }, ${ method } )`,
                "date": start,
                "calls": 1,
                duration,
                "exceptions": res.isException
                    ? 1
                    : 0,
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

        while ( true ) {
            if ( !this.#apiCalls.size ) break;

            const values = [ ...this.#apiCalls.values() ];
            this.#apiCalls = new Map();

            await this.#dbh.do( sql`
INSERT INTO monitoring_method_stats
`.VALUES( values, { "index": "firstRow" } ).sql`
ON CONFLICT ( monitoring_method_id, date ) DO UPDATE SET
    duration = monitoring_method_stats.duration + EXCLUDED.duration,
    calls = monitoring_method_stats.calls + EXCLUDED.calls,
    exceptions = monitoring_method_stats.exceptions + EXCLUDED.exceptions
` );

            if ( !this.#isDestroying ) break;
        }

        mutex.unlock();
    }

    async #monitorInstance () {
        const mark = await this.#instanceMonitoring.mark();

        const date = mark.startDate;
        date.setMilliseconds( 0 );
        date.setSeconds( 0 );

        return this.#dbh.do( SQL.monitorInstance, [

            // instamce
            this.#app.env.packageName,
            this.#app.env.serviceName,
            this.#app.env.instanceId,
            mark.ramTotal,
            mark.hddTotal,

            date,

            mark.cpuUsed,

            mark.ramUsed,
            mark.ramUsedPercent,

            mark.rssUsed,
            mark.rssUsedPercent,

            mark.hddUsed,
            mark.hddUsedPercent,
        ] );
    }
}
