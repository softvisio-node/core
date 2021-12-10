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
                this.#tasks[task.id] = new Cron( task.cron, { "timezone": task.timezone } ).on( "tick", this.#runTask.bind( this, task ) ).unref();

                // run missed task
                if ( !task.next_start || Date.parse( task.next_start ) <= new Date() ) this.#runTask( task, this.#tasks[task.id] );

                // start cron
                this.#tasks[task.id].start();
            }

            return result( 200 );
        }

        // private
        async #runTask ( task, cron ) {
            const dbh = this._newDbh();

            await dbh.selectRow( `SELECT _run_cron_task( ?, ? )`, [task.id, cron.nextDate] );

            dbh.destroy();
        }
    };
