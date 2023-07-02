import { sql } from "#lib/sql/query";
import Cron from "#lib/cron";
import Mutex from "#lib/threads/mutex";

export default class {
    #pool;
    #tasks = {};
    #started = false;
    #mutex = new Mutex();

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

        const res = await this.#pool.select( sql`SELECT * FROM _schema_cron` );

        if ( !res.ok ) return res;

        if ( res.data ) {
            for ( const row of res.data ) {
                const id = row.id;

                this.#tasks[id] = {
                    id,
                    "cron": new Cron( row.cron, { "timezone": row.timezone } ).on( "tick", () => this.#runTask( id ) ),
                    "queries": row.query.nap( query => sql( query ) ),
                    "runNow": row.run_missed && row.next_start && new Date( row.next_start ) <= new Date(),
                };
            }
        }

        for ( const task of Object.values( this.#tasks ) ) {
            task.cron.start();

            if ( task.runNow ) this.#runTask( task.id );
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
    // XXX
    async #runTask ( id ) {
        const task = this.#tasks[id];

        if ( !task ) return;

        const dbh = this.#getConnection();

        var res;

        if ( this.#pool.isPgsql ) {

            // set pgsql advisory lock
            res = await dbh.selectRow( sql`SELECT pg_advisory_lock( ${this.getLockId( "cron" )} )` );
            if ( !res.ok ) return res;

            // XXX
            console.log( "----", res.data );

            // already locked
            if ( !res.data ) return;
        }

        for ( const query of task.queries ) {
            res = await dbh.exec( query );
            console.log( res );
        }

        // remove pgsql advisory lock
        if ( this.#pool.isPgsql ) {
            const res = await dbh.selectRow( sql`SELECT pg_advisory_unlock( ${this.getLockId( "cron" )} )` );

            dbh.destroy();

            if ( !res.ok ) return res;
        }
    }

    #getConnection () {
        if ( this.#pool.isPgsql ) {
            return this.#pool._newConnection();
        }
        else {
            return this.#pool;
        }
    }
}
