import { sql } from "#lib/sql/query";
import Cron from "#lib/cron";

export default class {
    #pool;
    #tasks = {};
    #started = false;

    condtructor ( pool ) {
        this.#pool = pool;
    }

    // public
    async startCron () {
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
                    "queries": row.query,
                    "runNow": row.run_missed && row.next_start && new Date( row.next_start ) <= new Date(),
                };
            }
        }

        for ( const task of Object.values( this.#tasks ) ) {
            task.cron.start();

            if ( task.runNow ) this.#runTask( task.id );
        }
    }

    stopCron () {
        if ( !this.#started ) return;

        this.#started = false;

        for ( const task of Object.values( this.#tasks ) ) {
            task.cron.stop();
        }

        this.#tasks = {};
    }

    // private
    // XXX
    #runTask ( id ) {}
}
