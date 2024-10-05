import Cron from "#lib/cron";
import Events from "#lib/events";
import { sql } from "#lib/sql/query";
import Counter from "#lib/threads/counter";
import Mutex from "#lib/threads/mutex";

const SQL = {
    "startTask": sql`UPDATE _schema_cron SET last_start = CURRENT_TIMESTAMP, next_start = ? WHERE id = ? AND next_start <= CURRENT_TIMESTAMP`,

    "endTask": sql`UPDATE _schema_cron SET last_finish = CURRENT_TIMESTAMP, error = ?, status_text = ? WHERE id = ?`,
};

export default class {
    #pool;
    #tasks = {};
    #started = false;
    #events;
    #dbh;
    #activityCounter = new Counter();
    #mutex = new Mutex();

    constructor ( pool ) {
        this.#pool = pool;
    }

    // public
    async sync ( dbh, module, meta ) {
        var res;

        res = await dbh.select( sql`SELECT * FROM _schema_cron WHERE module = ?`.decode( { "query": String } ), [ module ] );
        if ( !res.ok ) return res;

        const index = {};

        if ( res.data ) {
            for ( const row of res.data ) {
                index[ row.name ] = row;
            }
        }

        if ( meta.cron ) {
            for ( const name in meta.cron ) {
                const query = JSON.stringify( Array.isArray( meta.cron[ name ].query )
                        ? meta.cron[ name ].query
                        : [ meta.cron[ name ].query ] ),
                    runMissed = meta.cron[ name ].runMissed ?? true,
                    cron = new Cron( meta.cron[ name ].cron, {
                        "timezone": meta.cron[ name ].timezone,
                    } );

                // insert
                if ( !index[ name ] ) {
                    res = await dbh.do( sql`INSERT INTO _schema_cron ( module, name, cron, timezone, query, run_missed, next_start ) VALUES ( ?, ?, ?, ?, ?, ?, ? )`, [ module, name, meta.cron[ name ].cron, meta.cron[ name ].timezone, query, runMissed, cron.nexTicktDate ] );

                    if ( !res.ok ) return res;
                }

                // update
                else if ( meta.cron[ name ].cron !== index[ name ].cron || meta.cron[ name ].timezone !== index[ name ].timezone || query !== index[ name ].query || runMissed !== index[ name ].run_missed ) {
                    res = await dbh.do( sql`UPDATE _schema_cron SET cron = ?, timezone = ?, query = ?, run_missed = ?, next_start = ? WHERE id = ?`, [ meta.cron[ name ].cron, meta.cron[ name ].timezone, query, runMissed, cron.nexTicktDate, index[ name ].id ] );

                    if ( !res.ok ) return res;
                }

                delete index[ name ];
            }
        }

        const toDelete = Object.keys( index ).map( name => index[ name ].id );

        if ( toDelete.length ) {
            res = await dbh.do( sql`DELETE FROM _schema_cron WHERE id`.IN( toDelete ) );

            if ( !res.ok ) return res;
        }

        return res;
    }

    async start () {
        if ( this.#started ) return;

        this.#started = true;

        if ( this.#pool.isPostgreSql ) {
            this.#events = new Events()
                .link( this.#pool )
                .on( "_schema_cron/update", this.#addTask.bind( this ) )
                .on( "_schema_cron/delete", data => this.#deleteTask( data.id ) );
        }

        const res = await this.#pool.select( sql`SELECT id, cron, timezone, query, run_missed, next_start FROM _schema_cron` );

        if ( !res.ok ) return res;

        if ( res.data ) {
            for ( const row of res.data ) {
                this.#addTask( row );
            }
        }

        return result( 200 );
    }

    stop () {
        if ( !this.#started ) return;

        this.#started = false;

        if ( this.#events ) {
            this.#events.clear();

            this.#events = null;
        }

        for ( const id of Object.keys( this.#tasks ) ) {
            this.#deleteTask( id );
        }

        return this.#activityCounter.wait();
    }

    async shutDown () {
        return this.stop();
    }

    // private
    #addTask ( data ) {
        const id = data.id;

        this.#deleteTask( id );

        this.#tasks[ id ] = {
            id,
            "cron": new Cron( data.cron, { "timezone": data.timezone } ).on( "tick", () => this.#runTask( id ) ),
            "queries": data.query.map( query => sql( query ) ),
            "started": false,
        };

        if ( this.#started ) {
            this.#tasks[ id ].cron.start();

            if ( data.run_missed && data.next_start && new Date( data.next_start ) <= new Date() ) {
                this.#runTask( data.id );
            }
        }
    }

    #deleteTask ( id ) {
        const task = this.#tasks[ id ];

        if ( !task ) return;

        task.cron.stop();

        delete this.#tasks[ id ];
    }

    async #runTask ( id ) {
        const task = this.#tasks[ id ];

        if ( !task ) return;

        if ( task.started ) return;

        task.started = true;

        this.#activityCounter.value++;

        var res;

        TASK: {
            const dbh = await this.#getConnection();

            if ( !dbh ) break TASK;

            try {

                // start task
                res = await dbh.do( SQL.startTask, [ task.cron.nexTicktDate, task.id ] );
                if ( !res.ok ) throw res;

                if ( !res.meta.rows ) break TASK;

                for ( const query of task.queries ) {
                    res = await dbh.exec( query );

                    if ( !res.ok ) throw res;
                }
            }
            catch {}

            // end task
            await this.#endTask( dbh, task.id, res );
        }

        this.#activityCounter.value--;

        // remove postgresql advisory lock
        this.#closeConnection();

        task.started = false;
    }

    async #getConnection () {
        if ( this.#pool.isPostgreSql ) {
            if ( this.#dbh ) return this.#dbh;

            if ( !this.#mutex.tryLock() ) return this.#mutex.wait();

            var dbh = this.#pool._newConnection();

            // set postgresql advisory lock
            const res = await dbh.selectRow( sql`SELECT pg_try_advisory_lock( ${ this.#pool.schema.getLockId( "cron" ) } ) AS locked` );

            // already locked
            if ( !res.data?.locked ) {
                dbh.destroy();

                dbh = null;
            }
            else {
                this.#dbh = dbh;
            }

            this.#mutex.unlock( dbh );

            return dbh;
        }
        else {
            return this.#pool;
        }
    }

    #closeConnection () {
        if ( this.#activityCounter.value ) return;

        if ( this.#pool.isPostgreSql && this.#dbh ) {
            this.#dbh.destroy();

            this.#dbh = null;
        }
    }

    async #endTask ( dbh, id, res ) {
        await dbh.do( SQL.endTask, [ res.ok, res.statusText, id ] );

        return res;
    }
}
