import Cron from "#lib/cron";
import { sql } from "#lib/sql/query";

const runTaskQuery = sql`SELECT _run_cron_task( ?, ?, ? )`.prepare();

export default Super =>
    class extends ( Super || Object ) {
        #tasks = {};

        // public
        async runCron () {
            if ( !this.schema.isLoaded ) return;

            const cron = await this.select( sql`SELECT * FROM _cron` );
            if ( !cron.ok ) return cron;

            if ( !cron.data ) return result( 200 );

            for ( const task of cron.data ) {
                const cron = ( this.#tasks[task.id] = new Cron( task.cron, { "timezone": task.timezone } ).on( "tick", this.#runTask.bind( this, task ) ).unref() );

                cron.tickDate = task.next_start;

                // run missed task
                if ( !task.next_start || Date.parse( task.next_start ) <= new Date() ) this.#runTask( task, cron );

                // start cron
                cron.start();
            }

            return result( 200 );
        }

        // private
        async #runTask ( task, cron ) {
            const nextDate = cron.nextDate.toISOString(),
                tickDate = cron.tickDate;

            cron.tickDate = nextDate;

            if ( task.new_connection ) {
                const dbh = this._newDbh();

                await dbh.selectRow( runTaskQuery, [task.id, tickDate, nextDate] );

                dbh.destroy();
            }
            else {
                this.selectRow( runTaskQuery, [task.id, tickDate, nextDate] );
            }
        }
    };
