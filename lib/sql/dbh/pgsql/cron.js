import sqlConst from "#lib/sql/const";
import Cron from "#lib/cron";

export default Super =>
    class extends ( Super || Object ) {
        #tasks = {};

        // public
        async runCron () {
            if ( !this.hasSchema ) return;

            const cron = await this.select( `SELECT * FROM "${sqlConst.cronTableName}"` );
            if ( !cron.ok ) return cron;

            if ( !cron.data ) return result( 200 );

            for ( const task of cron.data ) {
                const cron = ( this.#tasks[task.id] = new Cron( task.cron, { "timezone": task.timezone } ).on( "tick", this.#runTask.bind( this, task ) ).unref() );

                cron.tickId = task.next_start;

                // run missed task
                if ( !task.next_start || Date.parse( task.next_start ) <= new Date() ) this.#runTask( task, cron );

                // start cron
                this.#tasks[task.id].start();
            }

            return result( 200 );
        }

        // private
        async #runTask ( task, cron ) {
            const nextDate = cron.nextDate.toISOString(),
                tickId = cron.tickId;

            cron.tickId = nextDate;

            // this.selectRow( `SELECT _run_cron_task( ?, ?, ? )`, [task.id, tickId, nextDate] );

            const dbh = this._newDbh();

            await dbh.selectRow( `SELECT _run_cron_task( ?, ?, ? )`, [task.id, tickId, nextDate] );

            dbh.destroy();
        }
    };
