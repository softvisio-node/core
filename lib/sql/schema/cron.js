import { sql } from "#lib/sql/query";
import Cron from "#lib/cron";

const SQL = {
    "startTask": sql`UPDATE _schema_cron SET next_start = ?, last_started = CURRENT_TIMESTAMP, error = NULL WHERE id = ?`,

    "endTask": sql`UPDATE _schema_cron SET last_finished = CURRENT_TIMESTAMP, error = ? WHERE id = ?`,
};

export default class {
    #pool;
    #tasks = {};
    #started = false;

    constructor ( pool ) {
        this.#pool = pool;
    }

    // public
    async sync ( dbh, module, meta ) {
        var res;

        res = await dbh.select( sql`SELECT * FROM _schema_cron WHERE module = ?`.decode( { "query": String } ), [module] );
        if ( !res.ok ) return res;

        const index = {};

        if ( res.data ) {
            for ( const row of res.data ) {
                index[row.name] = row;
            }
        }

        if ( meta.cron ) {
            for ( const name in meta.cron ) {
                const query = JSON.stringify( Array.isArray( meta.cron[name].query ) ? meta.cron[name].query : [meta.cron[name].query] ),
                    runMissed = meta.cron[name].runMissed ?? true,
                    cron = new Cron( meta.cron[name].cron, { "timezone": meta.cron[name].timezone } );

                // insert
                if ( !index[name] ) {
                    res = await dbh.do( sql`INSERT INTO _schema_cron ( module, name, cron, timezone, query, run_missed, next_start ) VALUES ( ?, ?, ?, ?, ?, ?, ? )`, [module, name, meta.cron[name].cron, meta.cron[name].timezone, query, runMissed, cron.nextDate] );

                    if ( !res.ok ) return res;
                }

                // update
                else if ( meta.cron[name].cron !== index[name].cron || meta.cron[name].timezone !== index[name].timezone || query !== index[name].query || runMissed !== index[name].run_missed ) {
                    res = await dbh.do( sql`UPDATE _schema_cron SET cron = ?, timezone = ?, query = ?, run_missed = ?, next_start = ? WHERE id = ?`, [meta.cron[name].cron, meta.cron[name].timezone, query, runMissed, cron.nextDate, index[name].id] );

                    if ( !res.ok ) return res;
                }

                delete index[name];
            }
        }

        const toDelete = Object.keys( index ).map( name => index[name].id );

        if ( toDelete.length ) {
            res = await dbh.do( sql`DELETE FROM _schema_cron WHERE id`.IN( toDelete ) );

            if ( !res.ok ) return res;
        }

        return res;
    }

    async start () {
        if ( this.#started ) return;

        this.#started = true;

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

        for ( const task of Object.values( this.#tasks ) ) {
            task.cron.stop();
        }

        this.#tasks = {};
    }

    // private
    async #runTask ( id ) {
        const task = this.#tasks[id];

        if ( !task ) return;

        if ( task.started ) return;

        task.started = true;

        const dbh = this.#getConnection();

        var res;

        BREAK: {

            // set pgsql advisory lock
            if ( this.#pool.isPgsql ) {
                res = await dbh.selectRow( sql`SELECT pg_try_advisory_lock( ${this.#pool.schema.getLockId( "cron" )}, ${task.id} ) AS locked` );
                if ( !res.ok ) break BREAK;

                // already locked
                if ( !res.data.locked ) break BREAK;
            }

            try {

                // start task
                res = await dbh.do( SQL.startTask, [task.cron.nextDate, task.id] );
                if ( !res.ok ) throw res;

                for ( const query of task.queries ) {
                    res = await dbh.exec( query );

                    if ( !res.ok ) throw res;
                }
            }
            catch ( e ) {}

            // end task
            await this.#endTask( dbh, task.id, res );
        }

        // remove pgsql advisory lock
        if ( this.#pool.isPgsql ) {
            dbh.destroy();
        }

        task.started = false;
    }

    #getConnection () {
        if ( this.#pool.isPgsql ) {
            return this.#pool._newConnection();
        }
        else {
            return this.#pool;
        }
    }

    async #endTask ( dbh, id, res ) {
        await dbh.do( SQL.endTask, [res.ok ? null : res.statusText, id] );

        return res;
    }

    #addTask ( data ) {
        const id = data.id;

        this.#deleteTask( id );

        this.#tasks[id] = {
            id,
            "cron": new Cron( data.cron, { "timezone": data.timezone } ).on( "tick", () => this.#runTask( id ) ),
            "queries": data.query.map( query => sql( query ) ),
            "started": false,
        };

        if ( this.#started ) {
            this.#tasks[id].cron.start();

            if ( data.run_missed && data.next_start && new Date( data.next_start ) <= new Date() ) {
                this.#runTask( data.id );
            }
        }
    }

    #deleteTask ( id ) {
        const task = this.#tasks[id];

        if ( !task ) return;

        task.cron.stop();

        delete this.#tasks[id];
    }
}
